import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runPipeline } from "@/lib/forge-pipeline";
import { lookupArtists, lookupRecording } from "@/lib/musicbrainz";
import { optionalSupabaseAuth } from "@/lib/optional-auth";
import { chooseProvider } from "@/lib/provider";
import { BUILT_IN_CALLS_PER_HOUR, consumeUsage } from "@/lib/usage-limit";
import { SYSTEM } from "@/lib/forge-prompts";

const RoutingSchema = z.enum(["fast", "craft"]);

/** Generous for a song brief plus context, small enough to stop abuse. */
const MAX_PAYLOAD_CHARS = 60_000;

const InputSchema = z.object({
  task: z.enum([
    "blend",
    "song",
    "lyrics",
    "regenLine",
    "regenSection",
    "compare",
    "critique",
    "fixTake",
    "variants",
  ]),
  routing: RoutingSchema.default("fast"),
  apiKey: z.string().trim().max(300).optional(),
  payload: z
    .record(z.any())
    .refine((p) => JSON.stringify(p).length <= MAX_PAYLOAD_CHARS, "That input is too large."),
});

type Routing = z.infer<typeof RoutingSchema>;

const ANTHROPIC_MODELS: Record<Routing, string> = {
  fast: "claude-haiku-4-5-20251001",
  craft: "claude-sonnet-5-5",
};

const GATEWAY_MODELS: Record<Routing, string> = {
  fast: "google/gemini-3.8-flash",
  craft: "google/gemini-3.1-pro-preview",
};

/** Writing quality is the product, so these always use the stronger model, whatever the toggle says. */
const CRAFT_TASKS = new Set([
  "lyrics",
  "regenLine",
  "regenSection",
  "critique",
  "fixTake",
  "variants",
]);

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // First parse failed — try extracting just the {...} block.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // Both attempts failed — fall through to the standard error so
        // the retry in ask() always fires on any truncation or parse problem.
      }
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
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const choice = chooseProvider({
      userKey: data.apiKey,
      serverAnthropicKey: process.env["ANTHROPIC_API_KEY"],
      gatewayKey: process.env["LOVABLE_API_KEY"],
    });
    if (!choice) {
      throw new Error(
        "No Anthropic API key set and no built-in AI available. Add a key in the System panel.",
      );
    }
    const provider: "anthropic" | "built-in" = choice.ownerPays ? "built-in" : "anthropic";

    // A model the site owner pays for requires sign-in and is rate-limited.
    // Callers who bring their own key spend their own credits and are not restricted.
    if (choice.ownerPays) {
      if (!context.userId || !context.supabase) {
        throw new Error(
          "Sign in to use the built-in model, or add your own Anthropic API key in System & Credentials.",
        );
      }
      const usage = await consumeUsage(context.supabase, context.userId, data.task);
      if (!usage.allowed) {
        throw new Error(
          `You've used the ${BUILT_IN_CALLS_PER_HOUR} built-in model calls allowed per hour. Try again later, or add your own Anthropic API key in System & Credentials.`,
        );
      }
    }

    const routing: Routing = CRAFT_TASKS.has(data.task) ? "craft" : data.routing;

    const call = (text: string, maxTokens: number) =>
      withRateLimitRetry(() =>
        choice.via === "anthropic"
          ? callAnthropic(choice.key, routing, text, maxTokens)
          : callGateway(choice.key, routing, text, maxTokens),
      );

    // Lyrics tasks generate full song sections and need more room than a blend or critique.
    const initialTokens = ["lyrics", "regenSection"].includes(data.task) ? 4000 : 3000;

    const ask = async (text: string): Promise<Record<string, unknown>> => {
      try {
        return extractJson(await call(text, initialTokens)) as Record<string, unknown>;
      } catch (e) {
        const truncated = e instanceof Error && e.message.includes("could not be parsed");
        if (!truncated) throw e;
        // The response was likely cut off — retry once with more room to finish.
        return extractJson(await call(text, 8000)) as Record<string, unknown>;
      }
    };

    const contact = process.env["MUSICBRAINZ_CONTACT"];
    const mbOpts = contact ? { contact } : {};

    let result: unknown;
    try {
      result = await runPipeline(data.task, data.payload, {
        ask,
        lookup: (names) => lookupArtists(names, mbOpts),
        lookupRecording: (title, artist) => lookupRecording(title, artist, mbOpts),
      });
    } catch (e) {
      // Best-effort error log — never let this throw and mask the original error.
      if (context.supabase && context.userId) {
        try {
          await context.supabase.from("ai_errors").insert({
            user_id: context.userId,
            task: data.task,
            error_message: e instanceof Error ? e.message : String(e),
          });
        } catch {
          // swallow — logging failure must not overwrite the real error
        }
      }
      throw e;
    }

    return { provider, json: JSON.stringify(result) };
  });
