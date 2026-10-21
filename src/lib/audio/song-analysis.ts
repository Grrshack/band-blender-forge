/**
 * Song analysis that runs entirely in the browser: tempo, key, a section timeline with bar
 * counts, length, and tone (bass weight, brightness, loudness). Pure (no Web Audio), so it
 * is unit tested in node.
 *
 * What measurement can't do: name the genre, the instruments or the vocal style reliably.
 * The UI asks the person for those (or the song's name) and the AI combines both.
 */
import { measureLoudness } from "./mastering-dsp";
import { BAND_CENTERS, bandSpectrumDb, fft, relativeSpectrum } from "./spectrum";
import { mixToMono, windowLevelsDb } from "./take-diagnosis";
import { estimateBpm } from "./tempo";

export const PITCH_CLASSES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

// Krumhansl–Kessler key profiles (how strongly each scale degree is heard in a key).
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export type Confidence = "high" | "medium" | "low";

export type KeyResult = {
  /** e.g. "A minor". */
  label: string;
  tonic: string;
  mode: "major" | "minor";
  confidence: Confidence;
  /** The next most likely key (often the relative major/minor). */
  alternative: string;
};

export type Section = {
  start: number;
  end: number;
  energy: "low" | "mid" | "high";
  /** Bars at the measured tempo (4 beats per bar), or null without a tempo. */
  bars: number | null;
  /** A guess at the section's role, always phrased as a guess in the UI. */
  guess: string;
};

export type SongAnalysis = {
  durationSec: number;
  bpm: number | null;
  key: KeyResult | null;
  sections: Section[];
  loudnessLufs: number | null;
  tone: {
    bass: "light" | "balanced" | "heavy";
    brightness: "dark" | "balanced" | "bright";
    loudness: "quiet" | "typical" | "loud";
  };
};

/* ---------------- key ---------------- */

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Average pitch-class energy (C..B), from up to `maxSeconds` of audio. */
export function chromagram(mono: Float32Array, fs: number, maxSeconds = 300): number[] {
  // Average down to ~11 kHz: plenty for pitches up to ~2 kHz and 4x less work.
  const factor = Math.max(1, Math.floor(fs / 11025));
  const rate = fs / factor;
  const len = Math.min(Math.floor(mono.length / factor), Math.floor(maxSeconds * rate));
  const x = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let j = 0; j < factor; j++) s += mono[i * factor + j]!;
    x[i] = s / factor;
  }

  const N = 4096;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const binHz = rate / N;
  const loBin = Math.ceil(65 / binHz);
  const hiBin = Math.min(N / 2 - 1, Math.floor(2100 / binHz));
  const classOf = new Int8Array(hiBin + 1);
  for (let k = loBin; k <= hiBin; k++) {
    const midi = 69 + 12 * Math.log2((k * binHz) / 440);
    classOf[k] = ((Math.round(midi) % 12) + 12) % 12;
  }

  const total = new Array<number>(12).fill(0);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let pos = 0; pos + N <= len; pos += N) {
    for (let i = 0; i < N; i++) {
      re[i] = x[pos + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    const frame = new Array<number>(12).fill(0);
    for (let k = loBin; k <= hiBin; k++) frame[classOf[k]!]! += Math.sqrt(re[k]! ** 2 + im[k]! ** 2);
    const sum = frame.reduce((a, b) => a + b, 0);
    if (sum <= 1e-9) continue; // silence
    for (let c = 0; c < 12; c++) total[c]! += frame[c]! / sum;
  }
  return total;
}

export function detectKey(chroma: number[]): KeyResult | null {
  if (chroma.every((v) => v === 0)) return null;
  const scores: Array<{ tonic: number; mode: "major" | "minor"; r: number }> = [];
  for (let t = 0; t < 12; t++) {
    const rotated = chroma.map((_, i) => chroma[(i + t) % 12]!);
    scores.push({ tonic: t, mode: "major", r: pearson(rotated, MAJOR) });
    scores.push({ tonic: t, mode: "minor", r: pearson(rotated, MINOR) });
  }
  scores.sort((a, b) => b.r - a.r);
  const [best, second] = scores as [(typeof scores)[0], (typeof scores)[0]];
  const name = (s: (typeof scores)[0]) => `${PITCH_CLASSES[s.tonic]} ${s.mode}`;
  const margin = best.r - second.r;
  const confidence: Confidence =
    best.r > 0.75 && margin > 0.08 ? "high" : best.r > 0.55 && margin > 0.03 ? "medium" : "low";
  return {
    label: name(best),
    tonic: PITCH_CLASSES[best.tonic]!,
    mode: best.mode,
    confidence,
    alternative: name(second),
  };
}

/* ---------------- sections ---------------- */

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
export const formatTime = fmt;

/**
 * Splits the song where its loudness settles at a new level for a while. Sections shorter
 * than `minSec` are folded into the neighbour they sound most like. Boundaries snap to bars
 * when the tempo is known.
 */
export function findSections(levelsDb: number[], bpm: number | null, minSec = 8): Section[] {
  const n = levelsDb.length;
  if (n === 0) return [];
  // 5-second moving average so single hits and fills don't split sections.
  const smooth = levelsDb.map((_, i) => {
    const a = Math.max(0, i - 2);
    const b = Math.min(n, i + 3);
    let s = 0;
    for (let j = a; j < b; j++) s += levelsDb[j]!;
    return s / (b - a);
  });
  const audible = smooth.filter((v) => v > -50).sort((a, b) => a - b);
  if (!audible.length) return [{ start: 0, end: n, energy: "low", bars: null, guess: "Silence" }];
  const q = (p: number) => audible[Math.min(audible.length - 1, Math.floor(p * audible.length))]!;
  // Levels relative to the loud parts: within 2.5 dB of them is "high", 9 dB or more below is
  // "low". Relative, so it works for quiet ballads and heavily compressed masters alike.
  const top = q(0.95);
  const highCut = top - 2.5;
  const lowCut = top - 9;
  const tier = (v: number): Section["energy"] => (v >= highCut ? "high" : v <= lowCut ? "low" : "mid");

  type Run = { start: number; end: number; energy: Section["energy"]; level: number };
  let runs: Run[] = [];
  for (let i = 0; i < n; i++) {
    const e = tier(smooth[i]!);
    const last = runs[runs.length - 1];
    if (last && last.energy === e) last.end = i + 1;
    else runs.push({ start: i, end: i + 1, energy: e, level: 0 });
  }
  const avg = (r: Run) => {
    let s = 0;
    for (let i = r.start; i < r.end; i++) s += smooth[i]!;
    return s / (r.end - r.start);
  };
  runs.forEach((r) => (r.level = avg(r)));

  // Fold short runs into the neighbour with the closest level, then re-merge equal tiers.
  for (let guard = 0; guard < 200; guard++) {
    const i = runs.findIndex((r) => r.end - r.start < minSec);
    if (i === -1 || runs.length === 1) break;
    const r = runs[i]!;
    const prev = runs[i - 1];
    const next = runs[i + 1];
    const into =
      prev && next ? (Math.abs(prev.level - r.level) <= Math.abs(next.level - r.level) ? prev : next) : (prev ?? next)!;
    into.start = Math.min(into.start, r.start);
    into.end = Math.max(into.end, r.end);
    runs.splice(i, 1);
    const merged: Run[] = [];
    for (const x of runs) {
      const last = merged[merged.length - 1];
      if (last && last.energy === x.energy) last.end = x.end;
      else merged.push({ ...x });
    }
    runs = merged;
    runs.forEach((x) => (x.level = avg(x)));
  }

  // Smoothing blurs where a change happens, so move each boundary to the sharpest level
  // change (2 s before vs 2 s after) within 4 s of it.
  const meanOf = (a: number, b: number) => {
    const lo = Math.max(0, a);
    const hi = Math.min(n, b);
    let s = 0;
    for (let i = lo; i < hi; i++) s += levelsDb[i]!;
    return hi > lo ? s / (hi - lo) : 0;
  };
  for (let i = 1; i < runs.length; i++) {
    const b = runs[i]!.start;
    let best = b;
    let bestJump = -1;
    for (let t = Math.max(1, b - 4); t <= Math.min(n - 1, b + 4); t++) {
      const jump = Math.abs(meanOf(t, t + 2) - meanOf(t - 2, t));
      if (jump > bestJump) {
        bestJump = jump;
        best = t;
      }
    }
    if (best > runs[i - 1]!.start && best < runs[i]!.end) {
      runs[i - 1]!.end = best;
      runs[i]!.start = best;
    }
  }

  const barSec = bpm ? 240 / bpm : null;
  const snap = (t: number) => (barSec ? Math.round(t / barSec) * barSec : t);
  const out: Section[] = runs.map((r, i) => {
    const start = i === 0 ? 0 : snap(r.start);
    const end = i === runs.length - 1 ? n : snap(r.end);
    return { start, end, energy: r.energy, bars: barSec ? Math.max(1, Math.round((end - start) / barSec)) : null, guess: "" };
  });

  const highs = out.filter((s) => s.energy === "high").length;
  out.forEach((s, i) => {
    const first = i === 0;
    const last = i === out.length - 1;
    if (first && s.energy !== "high") s.guess = "Intro";
    else if (last && s.energy !== "high") s.guess = "Outro";
    else if (s.energy === "high") s.guess = highs > 1 ? "Chorus or drop" : "Peak";
    else if (s.energy === "mid") s.guess = "Verse";
    else s.guess = "Breakdown or bridge";
  });
  return out;
}

/* ---------------- tone ---------------- */

const at = (hz: number) => BAND_CENTERS.indexOf(hz as (typeof BAND_CENTERS)[number]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function toneFrom(bandsDb: number[], lufs: number | null): SongAnalysis["tone"] {
  const rel = relativeSpectrum(bandsDb);
  const bass = mean(rel.slice(at(40), at(125) + 1));
  const air = mean(rel.slice(at(6300), at(12500) + 1));
  return {
    bass: bass > 5 ? "heavy" : bass < -2 ? "light" : "balanced",
    brightness: air > -6 ? "bright" : air < -15 ? "dark" : "balanced",
    loudness: lufs === null ? "typical" : lufs > -9 ? "loud" : lufs < -16 ? "quiet" : "typical",
  };
}

/* ---------------- everything ---------------- */

export function analyzeSong(channels: Float32Array[], fs: number): SongAnalysis {
  const mono = mixToMono(channels);
  const durationSec = mono.length / fs;
  // Tempo from up to 90 seconds in the middle: steadier than the intro.
  const span = Math.min(mono.length, Math.floor(90 * fs));
  const from = Math.floor((mono.length - span) / 2);
  const bpm = estimateBpm(mono.subarray(from, from + span), fs);
  const key = detectKey(chromagram(mono, fs));
  const sections = findSections(windowLevelsDb(mono, fs, 1), bpm);
  const loud = measureLoudness(channels, fs);
  const lufs = Number.isFinite(loud.lufs) ? Math.round(loud.lufs * 10) / 10 : null;
  const tone = toneFrom(bandSpectrumDb(channels, fs, 60), lufs);
  return { durationSec, bpm, key, sections, loudnessLufs: lufs, tone };
}

/** Short tags to paste straight into Suno, e.g. "96 bpm, A minor". */
export function sunoTags(a: SongAnalysis): string {
  return [a.bpm ? `${a.bpm} bpm` : "", a.key && a.key.confidence !== "low" ? a.key.label : ""]
    .filter(Boolean)
    .join(", ");
}

/** The measurements as compact data for the AI. */
export function measuredForPrompt(a: SongAnalysis) {
  return {
    length: fmt(a.durationSec),
    bpm: a.bpm,
    bpmNote: a.bpm ? `could also be felt as ${Math.round(a.bpm / 2)} or ${a.bpm * 2} bpm` : "tempo unclear",
    key: a.key ? `${a.key.label} (confidence ${a.key.confidence}; alternative ${a.key.alternative})` : "unclear",
    sections: a.sections.map(
      (s) => `${fmt(s.start)}-${fmt(s.end)} ${s.energy} energy${s.bars ? `, ${s.bars} bars` : ""} (${s.guess}?)`,
    ),
    tone: `${a.tone.bass} bass, ${a.tone.brightness} top end, ${a.tone.loudness} master${a.loudnessLufs !== null ? ` (${a.loudnessLufs} LUFS)` : ""}`,
  };
}

/**
 * Turns the measured sections into a plan for Lyric Forge, in the same format as the
 * length planner: "[Intro] instrumental, 8 bars, no lyric lines; [Verse 1] 8 lines (16 bars)".
 */
export function structureFromSections(sections: Section[]): string {
  let verse = 0;
  return sections
    .map((s, i) => {
      const bars = s.bars ?? Math.max(4, Math.round((s.end - s.start) / 2));
      const edge = (i === 0 || i === sections.length - 1) && s.energy !== "high";
      if (edge) return `${i === 0 ? "[Intro]" : "[Outro]"} instrumental, ${bars} bars, no lyric lines`;
      const tag =
        s.energy === "high" ? "[Chorus]" : s.energy === "mid" ? `[Verse ${++verse}]` : "[Bridge]";
      return `${tag} ${Math.max(2, Math.round(bars / 2))} lines (${bars} bars)`;
    })
    .join("; ");
}
