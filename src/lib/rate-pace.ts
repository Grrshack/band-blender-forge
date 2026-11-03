/**
 * Pacing for batches of AI calls made from the browser (Lab Picks, Album Producer).
 * Google's free tier allows only about five requests a minute, so calls on a Gemini key are
 * spaced out, and a per-minute limit is waited out once before giving up.
 */

/** About five a minute, with a little room. */
export const GEMINI_FREE_GAP_MS = 13_000;
export const MINUTE_WAIT_MS = 60_000;

export type LimitKind = "day" | "minute" | null;

/** Reads the app's own rate-limit messages (see provider-errors.ts) and the providers' wording. */
export function limitKind(message: string): LimitKind {
  if (/today's|per day|daily|reset at midnight/i.test(message)) return "day";
  if (/per minute|limiting requests|too many requests|rate limit|quota|RESOURCE_EXHAUSTED/i.test(message)) return "minute";
  return null;
}

export type PaceState = { lastAt: number };

/**
 * Runs `fn` no sooner than `gapMs` after the previous call, and if it hits a per-minute limit,
 * waits a minute and tries once more. `onWait` says what it's waiting for (null when calling).
 */
export async function paced<T>(
  fn: () => Promise<T>,
  opts: {
    state: PaceState;
    gapMs: number;
    onWait?: (why: "pace" | "minute" | null) => void;
    wait?: (ms: number) => Promise<void>;
    now?: () => number;
  },
): Promise<T> {
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const gap = opts.state.lastAt + opts.gapMs - now();
  if (opts.state.lastAt && gap > 0) {
    opts.onWait?.("pace");
    await wait(gap);
  }
  for (let attempt = 0; ; attempt++) {
    opts.state.lastAt = now();
    opts.onWait?.(null);
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (limitKind(msg) !== "minute" || attempt >= 1) throw e;
      opts.onWait?.("minute");
      await wait(MINUTE_WAIT_MS);
    }
  }
}

export const WAIT_TEXT = {
  pace: "Spacing calls out: Google's free tier allows about five a minute…",
  minute: "Google asked for a pause. Waiting a minute, then trying again…",
} as const;

export const DAILY_TEXT =
  "Google's free daily allowance for this key is used up (on every Flash model). It resets at midnight Pacific time. Everything finished so far is kept; continue tomorrow, or turn on billing in Google AI Studio to keep going now.";
