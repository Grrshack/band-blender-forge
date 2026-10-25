/**
 * Compares your song with one you love, entirely in the browser. It reports how they differ
 * (structure, tempo, loudness, tone, width) and what to change, never which one is "better":
 * there's no honest measurement of better. Pure (no Web Audio), so it's unit tested in node.
 */
import { measureLoudness } from "./mastering-dsp";
import { analyzeSong, formatTime, type SongAnalysis } from "./song-analysis";
import { adviseFromReference, bandSpectrumDb } from "./spectrum";
import { mixToMono, windowLevelsDb } from "./take-diagnosis";

export type CompareMeasure = {
  analysis: SongAnalysis;
  /** 1/3-octave average spectrum (dB), for the tone comparison. */
  bandsDb: number[];
  /** Spread between the song's loud and quiet passages, in dB (bigger = more dynamic). */
  rangeDb: number | null;
  /** Side vs mid energy, 0 (mono) to about 100 (very wide). */
  widthPct: number | null;
  /** Highest sample, dBFS. */
  peakDb: number | null;
  /** When the first high-energy section starts, seconds. Null if the song never lifts. */
  firstLiftSec: number | null;
  /** How many separate high-energy sections the song has. */
  lifts: number;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Loud-to-quiet spread of the audible 1-second windows (80th minus 20th percentile). */
export function dynamicRange(levelsDb: number[]): number | null {
  const loudest = Math.max(...levelsDb);
  const audible = levelsDb.filter((v) => v > loudest - 30).sort((a, b) => a - b);
  if (audible.length < 8) return null;
  const q = (p: number) => audible[Math.min(audible.length - 1, Math.floor(p * audible.length))]!;
  return round1(q(0.8) - q(0.2));
}

/** Side energy relative to mid energy, as a percentage. Mono files come out at 0. */
export function stereoWidth(channels: Float32Array[]): number | null {
  if (channels.length < 2) return 0;
  const [l, r] = channels as [Float32Array, Float32Array];
  let mid = 0;
  let side = 0;
  // Every 4th sample is plenty for an average and keeps long songs quick.
  for (let i = 0; i < l.length; i += 4) {
    const m = (l[i]! + r[i]!) / 2;
    const s = (l[i]! - r[i]!) / 2;
    mid += m * m;
    side += s * s;
  }
  if (mid <= 0) return null;
  return Math.round(Math.min(100, (Math.sqrt(side) / Math.sqrt(mid)) * 100));
}

export function liftsFrom(analysis: SongAnalysis): { firstLiftSec: number | null; lifts: number } {
  const highs = analysis.sections.filter((s) => s.energy === "high");
  return { firstLiftSec: highs[0]?.start ?? null, lifts: highs.length };
}

export function measureForCompare(channels: Float32Array[], fs: number): CompareMeasure {
  const analysis = analyzeSong(channels, fs);
  const loud = measureLoudness(channels, fs);
  return {
    analysis,
    bandsDb: bandSpectrumDb(channels, fs, 60),
    rangeDb: dynamicRange(windowLevelsDb(mixToMono(channels), fs, 1)),
    widthPct: stereoWidth(channels),
    peakDb: loud.samplePeak > 0 ? round1(20 * Math.log10(loud.samplePeak)) : null,
    ...liftsFrom(analysis),
  };
}

/* ---------------- the comparison ---------------- */

/** Which tool fixes a difference. */
export type FixTool = "suno" | "master" | "fix" | null;

export type CompareRow = {
  id: string;
  label: string;
  yours: string;
  theirs: string;
  /** "close" = nothing to do; "differs" = worth a look. Never "better" or "worse". */
  status: "close" | "differs" | "info";
  /** What to do about it, in plain words. Empty when close. */
  tip: string;
  tool: FixTool;
};

export type Comparison = {
  rows: CompareRow[];
  /** 0–100: how closely your song's measurements track the reference. Not a quality score. */
  matchPct: number;
};

const t = (sec: number | null) => (sec === null ? "never" : formatTime(sec));

/** Tempo difference allowing for half/double time (90 and 180 bpm feel the same). */
export function tempoGap(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.abs(a * 2 - b), Math.abs(a - b * 2));
}

export function compareSongs(yours: CompareMeasure, theirs: CompareMeasure): Comparison {
  const y = yours.analysis;
  const r = theirs.analysis;
  const rows: CompareRow[] = [];
  // Each check adds how close it is (0–1) and how much it counts.
  const scores: Array<[number, number]> = [];

  // 1. When the first big lift (chorus or drop) arrives.
  {
    const a = yours.firstLiftSec;
    const b = theirs.firstLiftSec;
    let status: CompareRow["status"] = "close";
    let tip = "";
    if (a === null && b !== null) {
      status = "differs";
      tip = `Yours never clearly lifts; theirs hits a big section at ${t(b)}. In Suno, tag the chorus as [Chorus] and add words like "explosive chorus" or "big drop" to the style, or regenerate for a take with more contrast.`;
      scores.push([0, 3]);
    } else if (a !== null && b !== null) {
      const gap = a - b;
      if (gap > 8) {
        status = "differs";
        tip = `Your first big section arrives ${Math.round(gap)} s later than theirs. Shorten the intro: in Suno, edit or replace 0:00–${t(a)} with a shorter one, or ask for "[Short Intro]" next time.`;
      } else if (gap < -8) {
        status = "differs";
        tip = `Yours hits the big section ${Math.round(-gap)} s earlier. That can work, but the reference builds longer first; a verse or pre-chorus before it can make the lift land harder.`;
      }
      scores.push([Math.max(0, 1 - Math.abs(gap) / 40), 3]);
    } else if (a !== null && b === null) {
      status = "info";
      tip = "The reference stays at one level (no clear lift), so there's nothing to match here.";
    }
    rows.push({ id: "lift", label: "First big lift (chorus or drop)", yours: t(a), theirs: t(b), status, tip, tool: status === "differs" ? "fix" : null });
  }

  // 2. Intro length (the first section, if it isn't already a high one).
  {
    const intro = (m: SongAnalysis) => {
      const first = m.sections[0];
      return first && first.energy !== "high" ? first.end - first.start : 0;
    };
    const a = intro(y);
    const b = intro(r);
    const gap = a - b;
    const status = Math.abs(gap) > 10 ? "differs" : "close";
    rows.push({
      id: "intro",
      label: "Intro length",
      yours: formatTime(a),
      theirs: formatTime(b),
      status,
      tip:
        status === "close"
          ? ""
          : gap > 0
            ? `Your intro is ${Math.round(gap)} s longer. Listeners on streaming apps skip early, so a tighter intro usually helps.`
            : `Your intro is ${Math.round(-gap)} s shorter. Fine for streaming; add "[Intro]" with a few bars if it feels abrupt.`,
      tool: status === "close" ? null : "fix",
    });
    scores.push([Math.max(0, 1 - Math.abs(gap) / 40), 1]);
  }

  // 3. How many times the big section comes back.
  {
    const gap = yours.lifts - theirs.lifts;
    const status = theirs.lifts > 0 && Math.abs(gap) >= 2 ? "differs" : "close";
    rows.push({
      id: "lifts",
      label: "Big sections (times the energy peaks)",
      yours: String(yours.lifts),
      theirs: String(theirs.lifts),
      status,
      tip:
        status === "close"
          ? ""
          : gap < 0
            ? "Your big section comes back fewer times. Repeating the chorus (or adding a final double chorus) is what makes a hook stick."
            : "Yours peaks more often than the reference, so the lifts may feel less special. A quieter verse or bridge between them adds contrast.",
      tool: status === "close" ? null : "suno",
    });
    scores.push([theirs.lifts ? Math.max(0, 1 - Math.abs(gap) / 4) : 1, 1]);
  }

  // 4. Length.
  {
    const gap = y.durationSec - r.durationSec;
    const status = Math.abs(gap) > 30 ? "differs" : "close";
    rows.push({
      id: "length",
      label: "Length",
      yours: formatTime(y.durationSec),
      theirs: formatTime(r.durationSec),
      status,
      tip:
        status === "close"
          ? ""
          : gap > 0
            ? `Yours runs ${Math.round(gap)} s longer. Check for a repeated section or a long outro you could trim.`
            : `Yours is ${Math.round(-gap)} s shorter. Suno's Extend can add a bridge or a final chorus.`,
      tool: status === "close" ? null : "suno",
    });
    scores.push([Math.max(0, 1 - Math.abs(gap) / 120), 1]);
  }

  // 5. Tempo (half and double time count as the same feel).
  if (y.bpm && r.bpm) {
    const gap = tempoGap(y.bpm, r.bpm);
    const status = gap > 6 ? "differs" : "close";
    rows.push({
      id: "tempo",
      label: "Tempo",
      yours: `${y.bpm} BPM`,
      theirs: `${r.bpm} BPM`,
      status,
      tip: status === "close" ? "" : `Add "${r.bpm} bpm" to your Suno style prompt to match the reference's pace.`,
      tool: status === "close" ? null : "suno",
    });
    scores.push([Math.max(0, 1 - gap / 30), 2]);
  }

  // 6. Key: information only. Different keys aren't a problem to fix.
  if (y.key && r.key) {
    rows.push({ id: "key", label: "Key", yours: y.key.label, theirs: r.key.label, status: "info", tip: "", tool: null });
  }

  // 7. Loudness.
  if (y.loudnessLufs !== null && r.loudnessLufs !== null) {
    const gap = y.loudnessLufs - r.loudnessLufs;
    const status = Math.abs(gap) > 2 ? "differs" : "close";
    rows.push({
      id: "loudness",
      label: "Loudness",
      yours: `${y.loudnessLufs} LUFS`,
      theirs: `${r.loudnessLufs} LUFS`,
      status,
      tip:
        status === "close"
          ? ""
          : gap < 0
            ? `Yours is about ${round1(-gap)} dB quieter. In Mastering, raise the loudness target (Streaming ready is a good start).`
            : `Yours is about ${round1(gap)} dB louder. Streaming apps turn loud songs down anyway, so ease the loudness target in Mastering to keep some punch.`,
      tool: status === "close" ? null : "master",
    });
    scores.push([Math.max(0, 1 - Math.abs(gap) / 8), 2]);
  }

  // 8. Dynamics (how much loud and quiet parts differ).
  if (yours.rangeDb !== null && theirs.rangeDb !== null) {
    const gap = yours.rangeDb - theirs.rangeDb;
    const status = Math.abs(gap) > 3 ? "differs" : "close";
    rows.push({
      id: "dynamics",
      label: "Dynamics (loud vs quiet parts)",
      yours: `${yours.rangeDb} dB`,
      theirs: `${theirs.rangeDb} dB`,
      status,
      tip:
        status === "close"
          ? ""
          : gap < 0
            ? "Yours stays at one level more than the reference, which can sound flat or squashed. Ask Suno for a quieter verse or breakdown, and go easy on loudness in Mastering."
            : "Yours swings between loud and quiet more than the reference. If quiet parts get lost, a little glue in Mastering evens it out.",
      tool: status === "close" ? null : gap < 0 ? "suno" : "master",
    });
    scores.push([Math.max(0, 1 - Math.abs(gap) / 10), 1]);
  }

  // 9. Tone: reuse Mastering's reference advice (bass, mud, air), relative to the mids.
  {
    const advice = adviseFromReference(yours.bandsDb, theirs.bandsDb);
    const { bassGainDb, lowMidCutDb, airDb } = advice.delta;
    const changes = advice.lines.filter((l) => !/already close/i.test(l));
    const status = changes.length ? "differs" : "close";
    rows.push({
      id: "tone",
      label: "Tone (bass, mud, brightness)",
      yours: `${y.tone.bass} bass, ${y.tone.brightness} top`,
      theirs: `${r.tone.bass} bass, ${r.tone.brightness} top`,
      status,
      tip:
        status === "close"
          ? ""
          : `${changes.join(" ")} In Mastering, load the reference as your reference track to get these as settings.`.replace(/Reference/g, "The reference"),
      tool: status === "close" ? null : "master",
    });
    const off = Math.abs(bassGainDb) + Math.abs(lowMidCutDb) + Math.abs(airDb);
    scores.push([Math.max(0, 1 - off / 12), 2]);
  }

  // 10. Stereo width.
  if (yours.widthPct !== null && theirs.widthPct !== null) {
    const gap = yours.widthPct - theirs.widthPct;
    const status = Math.abs(gap) > 15 ? "differs" : "close";
    rows.push({
      id: "width",
      label: "Stereo width",
      yours: `${yours.widthPct}%`,
      theirs: `${theirs.widthPct}%`,
      status,
      tip:
        status === "close"
          ? ""
          : gap < 0
            ? 'Yours sounds narrower. Ask Suno for "wide stereo" or "lush stereo pads" in the style prompt.'
            : "Yours is wider than the reference. Very wide mixes can thin out on phone speakers; check it in mono.",
      tool: status === "close" ? null : "suno",
    });
    scores.push([Math.max(0, 1 - Math.abs(gap) / 50), 1]);
  }

  const weight = scores.reduce((s, [, w]) => s + w, 0);
  const matchPct = weight ? Math.round((scores.reduce((s, [v, w]) => s + v * w, 0) / weight) * 100) : 0;
  return { rows, matchPct };
}
