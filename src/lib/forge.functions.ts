import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import { runPipeline } from "@/lib/forge-pipeline";
import { lookupArtists, lookupRecording } from "@/lib/musicbrainz";
import { optionalSupabaseAuth } from "@/lib/optional-auth";
import { chooseProvider, isBuiltInAiAllowed, NO_KEY_MESSAGE } from "@/lib/provider";
import { BUILT_IN_CALLS_PER_HOUR, consumeUsage } from "@/lib/usage-limit";
import { SYSTEM } from "@/lib/forge-prompts";
import {
  AiTimeoutError,
  CALL_CAP_MS,
  PRO_CAP_MS,
  REQUEST_BUDGET_MS,
  fetchWithTimeout,
  isOverloaded,
  makeDeadline,
  overloadMessage,
  type Deadline,
  parseRateLimit,
  rateLimitMessage,
  withModelBackups,
  type RateLimitInfo,
} from "@/lib/provider-errors";

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
    "dossier",
    "refine",
    "masterSuggest",
    "intent",
  ]),
  routing: RoutingSchema.default("fast"),
  apiKey: z.string().trim().max(300).optional(),
  /** Set by the browser once it learns this Google key can't use Gemini Pro. */
  preferFast: z.boolean().optional(),
  payload: z
    .record(z.any())
    .refine((p) => JSON.stringify(p).length <= MAX_PAYLOAD_CHARS, "That input is too large."),
});

type Routing = z.infer<typeof RoutingSchema>;

const ANTHROPIC_MODELS: Record<Routing, string> = {
  fast: "claude-haiku-5-5",
  craft: "claude-sonnet-5-5",
};

const GATEWAY_MODELS: Record<Routing, string> = {
  fast: "google/gemini-3.8-flash",
  craft: "google/gemini-3.1-pro-preview",
};

// Google AI Studio (OpenAI-compatible endpoint). "fast" is confirmed in Google's docs;
// "craft" is unverified, so check it against AI Studio's model list if it returns 404.
const GEMINI_MODELS: Record<Routing, string> = {
  fast: "gemini-3.8-flash",
  craft: "gemini-3.1-pro-preview",
};

/**
 * Tried in order when the main Flash model is overloaded (Google's 503 "high demand").
 * Both are stable models listed at ai.google.dev/gemini-api/docs/models; update when
 * Google retires them.
 */
const GEMINI_BACKUP_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"] as const;

/** Writing quality is the product, so these always use the stronger model, whatever the toggle says. */
const CRAFT_TASKS = new Set([
  "lyrics",
  "regenLine",
  "regenSection",
  "critique",
  "fixTake",
  "variants",
  "refine",
  "masterSuggest",
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

/** The model is busy (503/529), not a limit on the user's key. */
class OverloadedError extends Error {
  constructor(provider = "") {
    super(overloadMessage(provider));
    this.name = "OverloadedError";
  }
}

class RateLimitError extends Error {
  constructor(
    readonly info: RateLimitInfo = { kind: "unknown", retryMs: null },
    provider = "",
  ) {
    super(rateLimitMessage(provider, info));
    this.name = "RateLimitError";
  }
}

function failure(status: number, provider: string, message: string): Error {
  // Google answers a bad key with 400 + API_KEY_INVALID rather than 401.
  const badGoogleKey =
    status === 400 && /API_KEY_INVALID|API key not valid|valid API key/i.test(message);
  if (status === 401 || status === 403 || badGoogleKey) {
    return new Error(
      provider === "anthropic"
        ? "Your Anthropic API key was rejected. Check you copied the whole key."
        : provider === "gemini"
          ? "Your Google Gemini key was rejected. Check you copied the whole key."
          : `Built-in AI is unavailable (${status}). ${message}`,
    );
  }
  if (status === 402) {
    return new Error(`Out of AI credits. ${message}`);
  }
  if (status === 429) {
    return new RateLimitError(parseRateLimit(message), provider);
  }
  if (isOverloaded(status, message)) {
    return new OverloadedError(provider);
  }
  return new Error(message || `Model request failed (${status}).`);
}

/**
 * Free Google keys can't use Gemini Pro, and Google reports that in several ways (a 429
 * with or without details, a 404 or 400 for the model). So for a Google key, any failure
 * of a "craft" call other than a rejected key is retried once on Flash, and the downgrade
 * is reported so later calls skip Pro.
 */
export async function withProFallback<T>(
  isGemini: boolean,
  routing: Routing,
  run: (r: Routing) => Promise<T>,
): Promise<{ value: T; downgraded: boolean }> {
  try {
    return { value: await run(routing), downgraded: false };
  } catch (e) {
    const badKey = e instanceof Error && /was rejected/i.test(e.message);
    if (!isGemini || routing !== "craft" || badKey) throw e;
    // A busy (503) or slow Pro says nothing about the key's access, so don't switch later calls to Flash.
    return { value: await run("fast"), downgraded: !(e instanceof OverloadedError || e instanceof AiTimeoutError) };
  }
}

export { RateLimitError, OverloadedError };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries a per-minute rate limit at most twice, waiting as long as the provider asks
 * (up to 20 s). Daily limits and models the key can't use are not retried: waiting a few
 * seconds won't help, and every retry spends the caller's free quota.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>, deadline?: Deadline): Promise<T> {
  const fallbackDelays = [3000, 8000];
  // Don't wait and retry if that would leave too little time to finish before the host's cut-off.
  const canWait = (ms: number) => !deadline || deadline.remaining() - ms > 20_000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OverloadedError && attempt < fallbackDelays.length && canWait(fallbackDelays[attempt]!)) {
        await sleep(fallbackDelays[attempt]!);
        continue;
      }
      if (!(e instanceof RateLimitError) || attempt >= fallbackDelays.length) throw e;
      const { kind, retryMs } = e.info;
      if (kind === "day" || kind === "unavailable") throw e;
      if (retryMs !== null && retryMs > 20000) throw e;
      const delay = retryMs ?? fallbackDelays[attempt]!;
      if (!canWait(delay)) throw e;
      await sleep(delay);
    }
  }
}

async function callAnthropic(
  apiKey: string,
  routing: Routing,
  user: string,
  maxTokens: number,
  timeoutMs: number = CALL_CAP_MS,
) {
  return fetchWithTimeout(timeoutMs, async (signal) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal,
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
  });
}

async function callGemini(
  key: string,
  routing: Routing,
  user: string,
  maxTokens: number,
  model: string = GEMINI_MODELS[routing],
  timeoutMs: number = CALL_CAP_MS,
) {
  return fetchWithTimeout(timeoutMs, async (signal) => {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    signal,
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw failure(res.status, "gemini", body.slice(0, 300));
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
  });
}

/** Flash, and if Google says it's overloaded, a retry and then the backup models. */
async function geminiFlashWithBackups(key: string, user: string, maxTokens: number, deadline?: Deadline) {
  const r = await withModelBackups(
    [GEMINI_MODELS.fast, ...GEMINI_BACKUP_MODELS],
    (model) => {
      deadline?.check();
      return callGemini(key, "fast", user, maxTokens, model, deadline ? deadline.capFor(CALL_CAP_MS) : CALL_CAP_MS);
    },
    {
      // A slow model counts as busy, so the next backup gets a turn while time remains.
      isBusy: (e) => e instanceof OverloadedError || (e instanceof AiTimeoutError && (deadline?.remaining() ?? 0) > 15_000),
      // A rejected key fails every model the same way, so stop there.
      isFatal: (e) =>
        (e instanceof Error && /was rejected/i.test(e.message)) ||
        (e instanceof AiTimeoutError && (deadline?.remaining() ?? 0) < 15_000),
      // A plain Error, so the outer retry doesn't run the whole chain again.
      exhausted: (last) => (last instanceof AiTimeoutError ? last : new Error(overloadMessage("gemini"))),
    },
  );
  return r.value;
}

async function callGateway(
  key: string,
  routing: Routing,
  user: string,
  maxTokens: number,
  timeoutMs: number = CALL_CAP_MS,
) {
  return fetchWithTimeout(timeoutMs, async (signal) => {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    signal,
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
  });
}

export const runForge = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const choice = chooseProvider({
      userKey: data.apiKey,
      serverAnthropicKey: process.env["ANTHROPIC_API_KEY"],
      serverGeminiKey: process.env["GEMINI_API_KEY"],
      gatewayKey: process.env["LOVABLE_API_KEY"],
      allowBuiltIn: isBuiltInAiAllowed(process.env),
    });
    if (!choice) throw new Error(NO_KEY_MESSAGE);
    const provider: "anthropic" | "built-in" = choice.ownerPays ? "built-in" : "anthropic";

    // A model the site owner pays for requires sign-in and is rate-limited.
    // Callers who bring their own key spend their own credits and are not restricted.
    // ALLOW_ANON_OWNER_KEY=true lets anyone use the owner's key without signing in and skips
    // the hourly limit. Use it for private/local runs only: on a public site, anyone could spend it.
    const allowAnonOwnerKey = process.env["ALLOW_ANON_OWNER_KEY"] === "true";
    if (choice.ownerPays && !allowAnonOwnerKey) {
      if (!context.userId || !context.supabase) {
        throw new Error(
          "Sign in to use the built-in model, or add your own API key (Anthropic or Gemini) in System & Credentials.",
        );
      }
      const usage = await consumeUsage(context.supabase, context.userId, data.task);
      if (!usage.allowed) {
        throw new Error(
          `You've used the ${BUILT_IN_CALLS_PER_HOUR} built-in model calls allowed per hour. Try again later, or add your own API key (Google Gemini or Anthropic).`,
        );
      }
    }

    // Everything below has to finish before the host's ~100 s cut-off (error 524).
    const deadline = makeDeadline(REQUEST_BUDGET_MS);
    let routing: Routing = CRAFT_TASKS.has(data.task) ? "craft" : data.routing;
    // A Google key that's known to lack Pro access goes straight to Flash.
    if (choice.via === "gemini" && data.preferFast) routing = "fast";
    let downgraded = false;

    const send = (r: Routing, text: string, maxTokens: number) => {
      deadline.check();
      const cap = deadline.capFor(CALL_CAP_MS);
      return choice.via === "anthropic"
        ? callAnthropic(choice.key, r, text, maxTokens, cap)
        : choice.via === "gemini"
          ? r === "craft"
            ? // a busy or slow Pro falls back to Flash below, so Pro gets less time
              callGemini(choice.key, r, text, maxTokens, GEMINI_MODELS.craft, deadline.capFor(PRO_CAP_MS))
            : geminiFlashWithBackups(choice.key, text, maxTokens, deadline)
          : callGateway(choice.key, r, text, maxTokens, cap);
    };
    // Gemini Pro on a Google key fails fast (no waiting and retrying) so the Flash fallback
    // kicks in at once; everything else retries short rate limits.
    const once = (r: Routing, text: string, maxTokens: number) =>
      choice.via === "gemini" && r === "craft"
        ? send(r, text, maxTokens)
        : withRateLimitRetry(() => send(r, text, maxTokens), deadline);

    const call = async (text: string, maxTokens: number) => {
      const r = await withProFallback(choice.via === "gemini", routing, (rt) => once(rt, text, maxTokens));
      if (r.downgraded) {
        routing = "fast";
        downgraded = true;
      }
      return r.value;
    };

    // Lyrics tasks generate full song sections and need more room than a blend or critique.
    const initialTokens = ["lyrics", "regenSection"].includes(data.task) ? 4000 : 3000;

    const ask = async (text: string): Promise<Record<string, unknown>> => {
      try {
        return extractJson(await call(text, initialTokens)) as Record<string, unknown>;
      } catch (e) {
        const truncated = e instanceof Error && e.message.includes("could not be parsed");
        // Only retry a cut-off answer if there's time for a second, longer one.
        if (!truncated || deadline.remaining() < 30_000) throw e;
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

    return { provider, json: JSON.stringify(result), downgraded };
  });

// ─── AI configuration + key check ───────────────────────────────────────────

/** Tells the client whether a key is required (own-key mode) or a built-in model exists. */
export const getAiConfig = createServerFn({ method: "GET" }).handler(async () => {
  const builtIn =
    isBuiltInAiAllowed(process.env) &&
    Boolean(
      process.env["ANTHROPIC_API_KEY"]?.trim() ||
        process.env["GEMINI_API_KEY"]?.trim() ||
        process.env["LOVABLE_API_KEY"]?.trim(),
    );
  return { builtIn };
});

/**
 * Makes the smallest possible request with the caller's key so they know it works
 * before they start. The key is used for this one request only and never stored.
 */
export const testApiKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ apiKey: z.string().trim().min(10).max(300) }).parse(input))
  .handler(async ({ data }) => {
    const choice = chooseProvider({ userKey: data.apiKey, allowBuiltIn: false });
    if (!choice) return { ok: false as const, message: "That doesn't look like a key." };
    try {
      if (choice.via === "anthropic") await callAnthropic(choice.key, "fast", "Reply with OK.", 256);
      else await callGemini(choice.key, "fast", "Reply with OK.", 256);
      return { ok: true as const, provider: choice.via };
    } catch (e) {
      if (e instanceof RateLimitError || e instanceof OverloadedError) {
        // The provider recognised the key but is throttling it or busy, so the key itself is fine.
        return { ok: true as const, provider: choice.via };
      }
      return { ok: false as const, message: e instanceof Error ? e.message : "The key check failed." };
    }
  });

// ─── Share blend ─────────────────────────────────────────────────────────────

/** Any JSON value the database can store. */
const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(JsonSchema),
  ]),
);

const ShareSchema = z.object({
  artists: z.array(z.string()),
  blendData: z.record(JsonSchema),
});

function makeSlug(artists: string[]): string {
  const base = artists
    .slice(0, 2)
    .map((a) =>
      a
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 12),
    )
    .join("-");
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

export const shareBlend = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(ShareSchema)
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) {
      throw new Error("Sign in to share a blend.");
    }
    const slug = makeSlug(data.artists);
    const { error } = await context.supabase.from("public_blends").insert({
      slug,
      user_id: context.userId,
      artists: data.artists,
      blend_data: data.blendData,
    });
    if (error) throw new Error("Could not save blend: " + error.message);
    return { slug };
  });

export const getSharedBlend = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"] ?? "",
      // Lovable Cloud (and HOSTING.md) set SUPABASE_PUBLISHABLE_KEY; SUPABASE_ANON_KEY is the legacy name.
      process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || "",
    );
    const { data: row, error } = await supabase
      .from("public_blends")
      .select("artists, blend_data, created_at")
      .eq("slug", data.slug)
      .single();
    if (error || !row) throw new Error("Blend not found.");
    return row as { artists: string[]; blend_data: Json; created_at: string };
  });
