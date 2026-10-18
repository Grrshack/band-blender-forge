/**
 * Turns a song's measurements into a plain verdict: which problems mastering will fix here,
 * which it only partly helps, and which need a fix in Suno instead. Pure, so it is unit tested.
 *
 * Band levels are dB relative to the song's full-range level (see track-analyzer). The
 * thresholds are deliberately conservative estimates for full mixes; findings are worded
 * as "looks" because a spectrum can't tell a style choice from a problem.
 */
import type { StemType } from "./mastering-chain";
import type { TakeMeasurements } from "./take-diagnosis";

export type VerdictKind = "fix" | "partly" | "elsewhere" | "ok";

export type VerdictItem = {
  kind: VerdictKind;
  title: string;
  detail: string;
  /** A preset that handles it, when mastering can. */
  preset?: string;
  /** Where to go instead, when it can't. */
  route?: "fix" | "lyrics";
  /** The Mastering control section that handles it, opened on request. */
  group?: "bass" | "lowband" | "sub" | "finish";
};

/** What mastering can and can't do, shown before any upload. */
export const MASTERING_CAN = [
  "Overall loudness (about −14 LUFS for Spotify, peaks under −1 dB)",
  "Booming or rumbling low end",
  "Muddy build-up around 200–500 Hz",
  "Stopping new clipping with a true-peak limiter",
  "Matching loudness across several songs",
];

export const MASTERING_CANT: Array<{ problem: string; instead: string }> = [
  { problem: "Buried or quiet vocals", instead: "Edit that part in Suno, or rebalance stems" },
  { problem: "A dull or muffled top end", instead: "Boosting it mostly raises noise; regenerate" },
  { problem: "Shimmer, warble or garbled words", instead: "Regenerate or edit that section in Suno" },
  { problem: "Squashed, lifeless dynamics", instead: "Can't be undone; regenerate with more dynamic tags" },
  { problem: "Distortion already in the file", instead: "Regenerate; a limiter only stops new clipping" },
  { problem: "A weak arrangement or lyric", instead: "Fix a Track or Lyric Forge" },
];

export function masteringVerdict(m: TakeMeasurements, stem: StemType = "mix"): VerdictItem[] {
  const items: VerdictItem[] = [];
  const b = m.spectrum.bands;
  const fullMix = stem === "mix";

  // Loudness: RMS in dBFS is a rough stand-in for LUFS (usually within a few dB).
  if (m.spectrum.rmsDb < -20) {
    items.push({
      kind: "fix",
      title: "Quieter than streaming level",
      detail: `Average level is about ${Math.round(m.spectrum.rmsDb)} dBFS. Export at −14 LUFS to match Spotify.`,
      preset: "Streaming ready",
    });
  } else if (m.spectrum.rmsDb > -8) {
    items.push({
      kind: "ok",
      title: "Already very loud",
      detail: "Don't push it louder; streaming services will turn it down anyway.",
    });
  }

  if (m.clippedPercent > 0.01) {
    items.push({
      kind: "partly",
      title: "Clipping in the file",
      detail: `${m.clippedPercent.toFixed(2)}% of samples hit full scale. The limiter stops new clipping, but distortion already baked in stays.`,
      route: "fix",
      group: "finish",
    });
  }

  if (fullMix && (b.sub > -3 || b.bass > 0)) {
    items.push({
      kind: "fix",
      title: "Heavy low end",
      detail: "The lows look louder than usual, which is common with Suno v6. Tightening controls the boom without cutting the bass.",
      preset: "Suno v6 starter",
      group: "lowband",
    });
  }

  if (fullMix && b.lowMid > -5) {
    items.push({
      kind: "fix",
      title: "Possible mud around 250–500 Hz",
      detail: "A small cut (1–3 dB) usually clears it.",
      preset: "Clean up boxy mix",
      group: "finish",
    });
  }

  if (fullMix && b.highMid > -9) {
    items.push({
      kind: "partly",
      title: "Bright or harsh upper mids",
      detail: "A gentle cut helps harshness, but shimmer or fizz from generation can't be removed by EQ.",
      route: "fix",
      group: "finish",
    });
  }

  if (fullMix && b.air < -32) {
    items.push({
      kind: "elsewhere",
      title: "Very little real top end",
      detail: "Boosting the highs here mostly raises noise. If it sounds muffled, regenerate or edit in Suno.",
      route: "fix",
    });
  }

  if (m.contrastDb < 3) {
    items.push({
      kind: "elsewhere",
      title: "Flat, squashed dynamics",
      detail: `Loud and quiet parts differ by only ${m.contrastDb} dB. Mastering can't restore that; regenerate asking for dynamics.`,
      route: "fix",
    });
  }

  if (m.endTailDb > -6 && m.durationSec > 20) {
    items.push({
      kind: "elsewhere",
      title: "Song stops abruptly",
      detail: "Mastering can't write an ending. Ask Suno v6 to edit the last section into an outro.",
      route: "fix",
    });
  }

  if (!items.some((i) => i.kind !== "ok")) {
    items.push({
      kind: "ok",
      title: "Nothing major measured",
      detail: "Start from a gentle preset and trust your ears; buried vocals and artifacts don't show in measurements.",
      ...(fullMix ? { preset: "Suno v6 starter" } : {}),
    });
  }
  return items;
}
