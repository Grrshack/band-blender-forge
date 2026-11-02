/**
 * Rough time stamps for each lyric section, so you can see where a section lands and whether
 * the song runs long. It's an estimate: Suno decides the real timing.
 *
 * Bars per section come from the length plan when there is one (same sections, same order),
 * otherwise from the lines: about 2 bars per sung line, 8 bars for an instrumental part.
 * Tempo comes from the style ("92 bpm"), or the blend's tempo field, or 100 BPM.
 */

export type TimedSection = { start: number; end: number; bars: number };
export type SectionTiming = { sections: TimedSection[]; totalSec: number; bpm: number; bpmGuessed: boolean; fromPlan: boolean };

type SectionLike = { tag: string; lines: unknown[] };

export const DEFAULT_BPM = 100;
const BARS_PER_LINE = 2;
const INSTRUMENTAL_BARS = 8;

/** First tempo in the text ("92 bpm", "120 BPM", "BPM 140"), within a musical range. */
export function bpmFrom(...texts: Array<string | undefined | null>): number | null {
  for (const t of texts) {
    if (!t) continue;
    const m =
      t.match(/(\d{2,3})\s*(?:[-–]\s*\d{2,3}\s*)?bpm\b/i) ??
      t.match(/\bbpm\s*:?\s*(\d{2,3})/i) ??
      t.match(/^\s*(\d{2,3})\s*$/);
    const n = m ? Number(m[1]) : NaN;
    if (n >= 50 && n <= 220) return n;
  }
  return null;
}

/** Bars per section from a length plan's text ("[Verse 1] 8 lines (16 bars); [Outro] instrumental, 8 bars, …"). */
export function barsFromPlan(plan: string | undefined): number[] {
  if (!plan) return [];
  return plan
    .split(";")
    .map((part) => {
      const m = part.match(/(\d+)\s*bars?\b/i);
      return m ? Number(m[1]) : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function sectionTimes(
  sections: SectionLike[],
  opts: { bpm?: number | null; plan?: string | undefined } = {},
): SectionTiming {
  const bpm = opts.bpm && opts.bpm >= 50 && opts.bpm <= 220 ? opts.bpm : DEFAULT_BPM;
  const barSec = (4 * 60) / bpm;
  const planBars = barsFromPlan(opts.plan);
  const fromPlan = planBars.length === sections.length && sections.length > 0;
  let t = 0;
  const out = sections.map((s, i) => {
    const bars = fromPlan ? planBars[i]! : s.lines.length ? s.lines.length * BARS_PER_LINE : INSTRUMENTAL_BARS;
    const start = t;
    t += bars * barSec;
    return { start, end: t, bars };
  });
  return { sections: out, totalSec: t, bpm, bpmGuessed: !opts.bpm, fromPlan };
}

export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
