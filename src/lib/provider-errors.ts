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

export type RateLimitInfo = { kind: RateLimitKind; retryMs: number | null };

export function parseRateLimit(body: string): RateLimitInfo {
  const text = body || "";
  const delay = /retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(text) ?? /retry in (\d+(?:\.\d+)?)\s*s/i.exec(text);
  const retryMs = delay ? Math.round(Number(delay[1]) * 1000) : null;

  if (/limit:\s*0\b/i.test(text) || /"quotaValue"\s*:\s*"0"/i.test(text) || /not available on the free tier/i.test(text)) {
    return { kind: "unavailable", retryMs: null };
  }
  if (/per\s*day|PerDay|daily/i.test(text)) return { kind: "day", retryMs };
  if (/per\s*minute|PerMinute|RPM|TPM/i.test(text) || retryMs !== null) return { kind: "minute", retryMs };
  return { kind: "unknown", retryMs: null };
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
      return "Rate limited by the model provider. Wait a moment and try again.";
  }
}
