import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RoutingSchema = z.enum(["fast", "craft"]);

const InputSchema = z.object({
  task: z.enum(["blend", "lyrics", "regenLine", "regenSection", "compare", "critique"]),
  routing: RoutingSchema.default("fast"),
  apiKey: z.string().trim().optional(),
  payload: z.record(z.any()),
});

type Routing = z.infer<typeof RoutingSchema>;

const ANTHROPIC_MODELS: Record<Routing, string> = {
  fast: "claude-3-5-haiku-latest",
  craft: "claude-sonnet-4-5",
};

const GATEWAY_MODELS: Record<Routing, string> = {
  fast: "google/gemini-3.8-flash",
  craft: "google/gemini-3.1-pro-preview",
};

const SYSTEM = `You are a pre-production planning engine for AI music generation (Suno-style).
You are ruthlessly specific. You never produce generic AI-slop language.
Banned lyric crutches: "neon lights", "concrete jungle", "shadows dance", "broken wings",
"burning bright", "fading light", "we are the ones", "chasing dreams", "heart of gold",
"tears like rain", "rise from the ashes", "electric feel".
Prioritise hook catchiness, syllabic rhythm and singability over end-rhyme.
Always reply with ONLY raw JSON. No markdown fences, no commentary.`;

function prompt(task: string, payload: Record<string, unknown>): string {
  const p = JSON.stringify(payload);
  switch (task) {
    case "blend":
      return `Blend these artists into one coherent, produceable style for AI music generation.
Input: ${p}
The "sliders" values are user-set 0-100 targets; honour them and reflect them in the output.
Assess your own real familiarity with each named artist honestly.
Return JSON exactly:
{"confidence":{"level":"high"|"medium"|"low","note":"one sentence, e.g. High artist familiarity"},
"genre":"string","tempo":"string with BPM range and feel","instrumentation":"string",
"vocals":"string","mood":"string",
"styleTag":"a single comma-separated Suno style prompt line, ordered: genre, subgenre, tempo/bpm, instrumentation, vocal type, production, mood",
"reconciliation":"2-4 sentences explaining exactly how conflicting elements of the chosen artists are fused, naming the specific conflicts and the resolution",
"recommendedSliders":{"energy":0-100,"complexity":0-100,"brightness":0-100},
"sliderNotes":"one sentence on why those values suit this blend"}`;
    case "lyrics":
      return `Write song lyrics for this brief.
Input: ${p}
Rules: hooks must be rhythmically repeatable and easy to sing; concrete images and specific nouns only;
avoid banned crutch phrases; vary line lengths; the chorus hook must land in its first 5 words.
Return JSON exactly:
{"title":"string","sections":[{"tag":"[Verse 1]","lines":["line","line"]}]}
Use standard tags: [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Bridge] [Outro] as appropriate.`;
    case "regenLine":
      return `Rewrite ONE lyric line inside an existing song, keeping syllable count and rhythm close, keeping meaning coherent with neighbours, and avoiding clichés.
Input: ${p}
Return JSON exactly: {"line":"the new line"}`;
    case "regenSection":
      return `Rewrite ONE section of an existing song. Keep locked lines EXACTLY as given (they are marked locked).
Input: ${p}
Return JSON exactly: {"tag":"[Chorus]","lines":["line","line"]}
Return the same number of lines, in order, with locked lines unchanged.`;
    case "compare":
      return `Reverse-lookup: given user lyrics and/or style tags, name real-world recording artists whose tone matches.
Input: ${p}
Return JSON exactly:
{"summary":"one sentence describing the detected tone",
"artists":[{"name":"real artist","match":0-100,"reasoning":["specific bullet","specific bullet","specific bullet"]}]}
Return 3 or 4 artists, real and verifiable, most similar first.`;
    case "critique":
      return `You are a blunt A&R critic. Give honest, specific, unflattering-where-deserved feedback on this song draft.
Input: ${p}
No praise padding, no hedging, no "great start". Quote exact lines when criticising. Every criticism carries a concrete fix.
Return JSON exactly:
{"verdict":"2-3 sentences, brutally direct overall judgement",
"scores":[{"label":"Hook strength","score":0-10,"note":"one sentence"},{"label":"Imagery","score":0-10,"note":"..."},{"label":"Singability","score":0-10,"note":"..."},{"label":"Structure","score":0-10,"note":"..."},{"label":"Originality","score":0-10,"note":"..."}],
"cliches":[{"line":"the exact offending line","why":"why it is worn out","fix":"a specific rewritten line"}],
"prosody":[{"line":"the exact line","note":"why it is awkward to sing and how to re-stress it"}],
"fixFirst":["most important fix","second","third"]}
Return every score. Return an empty array where nothing qualifies.`;
    default:
      throw new Error("Unknown task");
  }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("The model returned a response that could not be parsed.");
  }
}

class RateLimitError extends Error {
  constructor() {
    super("Rate limited by the model provider. Wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

function failure(status: number, provider: string, message: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      provider === "anthropic"
        ? "Your Anthropic API key was rejected. Check the key in the System panel."
        : `Built-in AI is unavailable (${status}). ${message}`,
    );
  }
  if (status === 402) {
    return new Error(`Out of AI credits. ${message}`);
  }
  if (status === 429) {
    return new RateLimitError();
  }
  return new Error(message || `Model request failed (${status}).`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries a call up to 5 attempts on rate limiting, waiting 2s, 4s, 8s, 16s. */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [2000, 4000, 8000, 16000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RateLimitError) || attempt >= delays.length) throw e;
      await sleep(delays[attempt]!);
    }
  }
}

async function callAnthropic(apiKey: string, routing: Routing, user: string, maxTokens: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODELS[routing],
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw failure(res.status, "anthropic", body.slice(0, 300));
  }
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  return json.content?.map((c) => c.text ?? "").join("") ?? "";
}

async function callGateway(key: string, routing: Routing, user: string, maxTokens: number) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: GATEWAY_MODELS[routing],
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw failure(res.status, "gateway", body.slice(0, 300));
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export const runForge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = prompt(data.task, data.payload);
    const userKey = data.apiKey?.trim();

    const provider: "anthropic" | "built-in" = userKey ? "anthropic" : "built-in";
    const gatewayKey = process.env["LOVABLE_API_KEY"];
    if (!userKey && !gatewayKey) {
      throw new Error(
        "No Anthropic API key set and no built-in AI available. Add a key in the System panel.",
      );
    }

    const attempt = (maxTokens: number) =>
      withRateLimitRetry(() =>
        userKey
          ? callAnthropic(userKey, data.routing, user, maxTokens)
          : callGateway(gatewayKey!, data.routing, user, maxTokens),
      );

    try {
      const raw = await attempt(3000);
      return { provider, json: JSON.stringify(extractJson(raw)) };
    } catch (e) {
      const truncated = e instanceof Error && e.message.includes("could not be parsed");
      if (!truncated) throw e;
      // The response was likely cut off — retry once with more room to finish.
      const raw = await attempt(8000);
      return { provider, json: JSON.stringify(extractJson(raw)) };
    }
  });
