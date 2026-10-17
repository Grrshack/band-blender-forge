/**
 * Measures a generated song in the browser so Fix a Track can diagnose what's actually in
 * the audio, not just what the person describes. Nothing is uploaded: only the numbers
 * below are sent to the AI.
 */
import { analyzeTrack, type TrackAnalysis } from "./track-analyzer";

export type TakeMeasurements = {
  durationSec: number;
  /** Frequency balance of a 30 s window from the middle of the song (skips intros). */
  spectrum: TrackAnalysis;
  /** Share of samples at or above full scale. Above ~0.01% is audible distortion risk. */
  clippedPercent: number;
  /** Loudness per window in dB (RMS), up to 24 points across the whole song. */
  contourDb: number[];
  /** Difference between loud and quiet parts (90th minus 20th percentile window, dB). */
  contrastDb: number;
  /** Seconds of near-silence before the music starts. */
  leadInSec: number;
  /** Loudness of the final second relative to the song's average, dB. */
  endTailDb: number;
  /** Plain-language findings the measurements support with confidence. */
  flags: string[];
};

const SILENCE_DB = -50;

const toDb = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

export function mixToMono(channels: Float32Array[]): Float32Array {
  const len = channels[0]?.length ?? 0;
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i]! += ch[i]! / channels.length;
  return mono;
}

/** RMS level in dB for consecutive windows of `windowSec`. */
export function windowLevelsDb(mono: Float32Array, fs: number, windowSec: number): number[] {
  const size = Math.max(1, Math.floor(fs * windowSec));
  const out: number[] = [];
  for (let start = 0; start < mono.length; start += size) {
    const end = Math.min(mono.length, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) sum += mono[i]! * mono[i]!;
    out.push(toDb(Math.sqrt(sum / Math.max(1, end - start))));
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return -120;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

/** Averages a series down to at most `points` values for display and the AI payload. */
export function downsample(values: number[], points: number): number[] {
  if (values.length <= points) return values.map((v) => Math.round(v * 10) / 10);
  const out: number[] = [];
  const step = values.length / points;
  for (let i = 0; i < points; i++) {
    const slice = values.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    out.push(Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10);
  }
  return out;
}

/** The time-domain measurements, kept separate from decoding so they can be unit tested. */
export function measureLevels(channels: Float32Array[], fs: number) {
  const mono = mixToMono(channels);
  let clipped = 0;
  for (const ch of channels)
    for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]!) >= 0.999) clipped++;
  const total = channels.reduce((n, ch) => n + ch.length, 0);
  const clippedPercent = total ? (clipped / total) * 100 : 0;

  const perSecond = windowLevelsDb(mono, fs, 1);
  const audible = perSecond.filter((d) => d > SILENCE_DB);
  const average = audible.length ? audible.reduce((a, b) => a + b, 0) / audible.length : -120;

  let leadInSec = 0;
  while (leadInSec < perSecond.length && perSecond[leadInSec]! <= SILENCE_DB) leadInSec++;

  const lastAudible = (() => {
    for (let i = perSecond.length - 1; i >= 0; i--) if (perSecond[i]! > SILENCE_DB) return i;
    return -1;
  })();
  const endTailDb = lastAudible >= 0 ? perSecond[lastAudible]! - average : -120;

  const contrastDb = percentile(audible, 0.9) - percentile(audible, 0.2);
  return {
    durationSec: mono.length / fs,
    clippedPercent,
    contourDb: downsample(windowLevelsDb(mono, fs, 2), 24),
    contrastDb: Math.round(contrastDb * 10) / 10,
    leadInSec,
    endTailDb: Math.round(endTailDb * 10) / 10,
    averageDb: average,
  };
}

/** Findings the numbers support well enough to state plainly. Spectral judgement is left to the AI. */
export function flagsFor(m: {
  clippedPercent: number;
  contrastDb: number;
  leadInSec: number;
  endTailDb: number;
  averageDb: number;
  durationSec: number;
}): string[] {
  const flags: string[] = [];
  if (m.clippedPercent > 0.01)
    flags.push(
      `Clipping: ${m.clippedPercent.toFixed(2)}% of samples hit full scale, which can sound distorted.`,
    );
  if (m.contrastDb < 3)
    flags.push(
      `Flat dynamics: loud and quiet parts differ by only ${m.contrastDb} dB, so choruses probably don't lift.`,
    );
  if (m.endTailDb > -6 && m.durationSec > 20)
    flags.push(
      "Abrupt ending: the last second is nearly as loud as the rest, so the song likely cuts off.",
    );
  if (m.leadInSec >= 3) flags.push(`${m.leadInSec} seconds of silence before the music starts.`);
  if (m.averageDb < -26) flags.push("Very quiet overall: it will sound weak next to other songs.");
  return flags;
}

/** Decodes an audio file and measures it. Throws a readable error if the file can't be decoded. */
export async function measureTake(file: File): Promise<TakeMeasurements> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("This browser can't decode audio.");
  const ctx = new Ctx();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("Couldn't read that file. Try an MP3, WAV, M4A or FLAC.");
  } finally {
    void ctx.close();
  }

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  const levels = measureLevels(channels, buffer.sampleRate);

  // Analyse 30 s from the middle, where the full arrangement usually plays.
  const windowLen = Math.min(buffer.length, Math.floor(30 * buffer.sampleRate));
  const start = Math.max(0, Math.floor((buffer.length - windowLen) / 2));
  const middle = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: windowLen,
    sampleRate: buffer.sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    middle.copyToChannel(buffer.getChannelData(c).subarray(start, start + windowLen), c);
  }
  const spectrum = await analyzeTrack(middle);

  return {
    durationSec: Math.round(levels.durationSec),
    spectrum,
    clippedPercent: Math.round(levels.clippedPercent * 1000) / 1000,
    contourDb: levels.contourDb,
    contrastDb: levels.contrastDb,
    leadInSec: levels.leadInSec,
    endTailDb: levels.endTailDb,
    flags: flagsFor(levels),
  };
}
