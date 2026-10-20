/**
 * Reads a 429 from the model provider so the app can say what actually happened and react
 * sensibly: wait and retry, fall back to a free model, or stop. Pure, so it's unit tested.
 */
export type RateLimitKind =
  /** Too many requests this minute: waiting helps. */
  | "minute"
  /** The daily allowance for this model is used up: waiting a few seconds won't help. */
  | "day"
  /** This model has no allowance at all on this key (e.g. a Pro model on Google's free tier). */
  | "unavailable"
  /** A 429 without details. */
  | "unknown";

export type RateLimitInfo = { kind: RateLimitKind; retryMs: number | null; reason?: string | undefined };

export function parseRateLimit(body: string): RateLimitInfo {
  const text = body || "";
  const delay = /retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(text) ?? /retry in (\d+(?:\.\d+)?)\s*s/i.exec(text);
  const retryMs = delay ? Math.round(Number(delay[1]) * 1000) : null;

  if (/limit:\s*0\b/i.test(text) || /"quotaValue"\s*:\s*"0"/i.test(text) || /not available on the free tier/i.test(text)) {
    return { kind: "unavailable", retryMs: null };
  }
  if (/per\s*day|PerDay|daily/i.test(text)) return { kind: "day", retryMs };
  if (/per\s*minute|PerMinute|RPM|TPM/i.test(text) || retryMs !== null) return { kind: "minute", retryMs };
  return { kind: "unknown", retryMs: null, reason: shortReason(text) };
}

/** The provider's own wording, trimmed, so an unrecognised limit still says something useful. */
function shortReason(text: string): string | undefined {
  const m = /"message"\s*:\s*"([^"]{1,200})/.exec(text);
  const raw = (m?.[1] ?? text).replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, 140) : undefined;
}

export function rateLimitMessage(provider: string, info: RateLimitInfo): string {
  const google = provider === "gemini";
  switch (info.kind) {
    case "unavailable":
      return google
        ? "This Gemini model isn't included in Google's free tier. Turn off \"Best quality\" in the key settings, or turn on billing in Google AI Studio."
        : "Your key doesn't have access to this model.";
    case "day":
      return google
        ? "You've used today's free Gemini requests for this model. They reset at midnight Pacific time, or you can turn on billing in Google AI Studio."
        : "You've reached today's limit for this key. Try again tomorrow or raise the limit with your provider.";
    case "minute": {
      const secs = info.retryMs ? Math.max(1, Math.ceil(info.retryMs / 1000)) : null;
      return google
        ? `Google's free tier allows only a few requests per minute.${secs ? ` Wait about ${secs} seconds` : " Wait a minute"} and try again.`
        : `Too many requests this minute.${secs ? ` Wait about ${secs} seconds` : " Wait a moment"} and try again.`;
    }
    default:
      return `${google ? "Google" : "The model provider"} is limiting requests. Wait a minute and try again.${info.reason ? ` (${info.reason})` : ""}`;
  }
}

/**
 * "The model is busy" rather than "you're over a limit": Google's 503 UNAVAILABLE ("high
 * demand"), Anthropic's 529 overloaded_error, and plain 500/502/504 gateway errors.
 * Waiting a moment or switching model helps; it says nothing about the user's key or quota.
 */
export function isOverloaded(status: number, body = ""): boolean {
  if ([500, 502, 503, 504, 529].includes(status)) return true;
  return /overloaded|high demand|"status"\s*:\s*"UNAVAILABLE"/i.test(body);
}

export function overloadMessage(provider: string): string {
  return provider === "gemini"
    ? "Google's Gemini models are overloaded right now (this is on Google's side, not your key). We tried backup models too. Wait a minute and try again."
    : provider === "anthropic"
      ? "Anthropic's servers are overloaded right now (not your key). Wait a minute and try again."
      : "The AI service is busy right now. Wait a minute and try again.";
}

/**
 * Runs a Gemini call, and if the model is busy, retries it once and then tries each backup
 * model in turn. A backup that fails for any reason other than a bad key is skipped, so one
 * overloaded model never blocks the whole tool. Network-free so it's unit tested.
 */
export async function withModelBackups<T>(
  models: readonly string[],
  run: (model: string) => Promise<T>,
  opts: {
    isBusy: (e: unknown) => boolean;
    isFatal: (e: unknown) => boolean;
    wait?: (ms: number) => Promise<void>;
    retryDelayMs?: number;
    /** The error to throw once every model was busy or failed. Defaults to the last error. */
    exhausted?: (last: unknown) => unknown;
  },
): Promise<{ value: T; model: string }> {
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const [primary, ...backups] = models;
  if (!primary) throw new Error("No model configured.");
  let lastError: unknown;
  try {
    return { value: await run(primary), model: primary };
  } catch (e) {
    if (!opts.isBusy(e)) throw e;
    lastError = e;
  }
  await wait(opts.retryDelayMs ?? 1500);
  try {
    return { value: await run(primary), model: primary };
  } catch (e) {
    if (!opts.isBusy(e)) throw e;
    lastError = e;
  }
  for (const m of backups) {
    try {
      return { value: await run(m), model: m };
    } catch (e) {
      if (opts.isFatal(e)) throw e;
      lastError = e;
    }
  }
  throw opts.exhausted ? opts.exhausted(lastError) : lastError;
}
