/**
 * Cover art from a prompt, using the person's own Google key. The request goes straight from
 * the browser to Google (the key never touches our server, and a slow image can't hit the
 * host's time limit). Tries the newest image model first and falls back to the older one.
 */

export const IMAGE_MODELS = [
  // Nano Banana 2: larger images, may need billing on the key.
  { id: "gemini-3.1-flash-image", size: "2K" as const },
  // Nano Banana: 1024px, reported to work on free keys with a daily allowance.
  { id: "gemini-2.5-flash-image", size: null },
];

export type ImageResult = { blob: Blob; model: string };

export class CoverAiError extends Error {
  constructor(
    message: string,
    readonly kind: "key" | "quota" | "safety" | "model" | "network" | "other",
  ) {
    super(message);
    this.name = "CoverAiError";
  }
}

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
type GenResponse = {
  candidates?: Array<{ content?: { parts?: Part[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

/** Pulls the first image out of a generateContent response, or says why there isn't one. */
export function imageFromResponse(json: GenResponse): { data: string; mime: string } {
  if (json.promptFeedback?.blockReason) {
    throw new CoverAiError("Google blocked that prompt. Try describing the scene differently.", "safety");
  }
  const cand = json.candidates?.[0];
  for (const p of cand?.content?.parts ?? []) {
    const d = p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : undefined);
    if (d?.data) return { data: d.data, mime: d.mimeType ?? "image/png" };
  }
  if (cand?.finishReason && /SAFETY|PROHIBITED|BLOCK/i.test(cand.finishReason)) {
    throw new CoverAiError("Google's safety filter stopped that image. Try a different scene or wording.", "safety");
  }
  const text = cand?.content?.parts?.find((p) => p.text)?.text;
  throw new CoverAiError(text ? `No image came back: ${text.slice(0, 160)}` : "No image came back. Try again.", "other");
}

/** Turns an error response into something a person can act on. */
export function errorFromStatus(status: number, body: string): CoverAiError {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) {
    return new CoverAiError("Your Google key was rejected. Check it in the key settings.", "key");
  }
  if (status === 401 || status === 403) {
    return new CoverAiError("Your Google key isn't allowed to make images.", "quota");
  }
  if (status === 404 || /not found|is not supported/i.test(body)) {
    return new CoverAiError("This image model isn't available on your key.", "model");
  }
  if (status === 429) {
    return /limit:\s*0|free_tier|FreeTier/i.test(body)
      ? new CoverAiError(
          "Your free Google key can't make images with this model. Turn on billing in Google AI Studio (a few cents an image), or use the free Gemini app with the prompt below.",
          "quota",
        )
      : new CoverAiError("Google's image limit for your key is used up for now. Wait a minute, or try again tomorrow.", "quota");
  }
  if (status >= 500) return new CoverAiError("Google's image service is busy. Try again in a moment.", "network");
  return new CoverAiError(`Image request failed (${status}).`, "other");
}

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function generateCoverImage(apiKey: string, prompt: string, signal?: AbortSignal): Promise<ImageResult> {
  let last: CoverAiError | null = null;
  for (const m of IMAGE_MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1", ...(m.size ? { imageSize: m.size } : {}) },
          },
        }),
        ...(signal ? { signal } : {}),
      });
    } catch {
      last = new CoverAiError("Couldn't reach Google. Check your connection and try again.", "network");
      continue;
    }
    if (!res.ok) {
      const err = errorFromStatus(res.status, await res.text());
      if (err.kind === "key") throw err;
      last = err;
      continue; // try the older model
    }
    const img = imageFromResponse((await res.json()) as GenResponse);
    return { blob: base64ToBlob(img.data, img.mime), model: m.id };
  }
  throw last ?? new CoverAiError("No image model worked with this key.", "other");
}
