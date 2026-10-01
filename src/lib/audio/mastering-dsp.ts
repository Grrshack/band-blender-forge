/**
 * Pure DSP helpers for the Mastering Lab. No DOM / Web Audio imports, so these
 * can be unit-tested in plain node.
 */

export type Loudness = {
  /** Integrated loudness (ITU-R BS.1770-4, gated), or -Infinity for silence / too-short audio. */
  lufs: number;
  /** Highest absolute sample value across all channels (linear, not true-peak). */
  samplePeak: number;
};

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** K-weighting pre-filter (stage 1) + RLB high-pass (stage 2) for a given sample rate. */
function kWeighting(fs: number): [Biquad, Biquad] {
  // Stage 1: high shelf, ~+4 dB above ~1.7 kHz
  const G = 3.99984385397;
  const Q = 0.7071752369554193;
  const fc = 1681.9744509555319;
  const K = Math.tan((Math.PI * fc) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  const s1: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: high-pass at ~38 Hz
  const Q2 = 0.5003270373253953;
  const fc2 = 38.13547087613982;
  const K2 = Math.tan((Math.PI * fc2) / fs);
  const a02 = 1 + K2 / Q2 + K2 * K2;
  const s2: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K2 * K2 - 1)) / a02,
    a2: (1 - K2 / Q2 + K2 * K2) / a02,
  };
  return [s1, s2];
}

/**
 * Integrated loudness per BS.1770-4: K-weight, 400 ms blocks with 75 % overlap,
 * absolute gate at -70 LUFS, relative gate 10 LU below the ungated mean.
 * Only the first two channels are used (weight 1.0 each).
 */
export function measureLoudness(channels: Float32Array[], fs: number): Loudness {
  const len = channels[0]?.length ?? 0;
  let samplePeak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]!);
      if (v > samplePeak) samplePeak = v;
    }
  }

  const step = Math.round(fs * 0.1); // 100 ms hop
  const nSteps = Math.floor(len / step);
  if (nSteps < 4) return { lufs: -Infinity, samplePeak };

  const [s1, s2] = kWeighting(fs);
  const used = channels.slice(0, 2);
  const stepSums = used.map(() => new Float64Array(nSteps));

  used.forEach((ch, c) => {
    let x1 = 0,
      x2 = 0,
      y1a = 0,
      y2a = 0; // stage 1 state
    let u1 = 0,
      u2 = 0,
      v1 = 0,
      v2 = 0; // stage 2 state
    for (let s = 0; s < nSteps; s++) {
      let acc = 0;
      const base = s * step;
      for (let i = 0; i < step; i++) {
        const x = ch[base + i]!;
        const y = s1.b0 * x + s1.b1 * x1 + s1.b2 * x2 - s1.a1 * y1a - s1.a2 * y2a;
        x2 = x1;
        x1 = x;
        y2a = y1a;
        y1a = y;
        const z = s2.b0 * y + s2.b1 * u1 + s2.b2 * u2 - s2.a1 * v1 - s2.a2 * v2;
        u2 = u1;
        u1 = y;
        v2 = v1;
        v1 = z;
        acc += z * z;
      }
      stepSums[c]![s] = acc;
    }
  });

  // 400 ms block = 4 consecutive 100 ms steps
  const nBlocks = nSteps - 3;
  const blockZ = new Float64Array(nBlocks);
  for (let j = 0; j < nBlocks; j++) {
    let z = 0;
    for (let c = 0; c < used.length; c++) {
      const sums = stepSums[c]!;
      z += (sums[j]! + sums[j + 1]! + sums[j + 2]! + sums[j + 3]!) / (4 * step);
    }
    blockZ[j] = z;
  }

  const toLufs = (z: number) => -0.691 + 10 * Math.log10(z);

  let absSum = 0,
    absN = 0;
  for (let j = 0; j < nBlocks; j++) {
    if (blockZ[j]! > 0 && toLufs(blockZ[j]!) > -70) {
      absSum += blockZ[j]!;
      absN++;
    }
  }
  if (absN === 0) return { lufs: -Infinity, samplePeak };

  const relGate = toLufs(absSum / absN) - 10;
  let sum = 0,
    n = 0;
  for (let j = 0; j < nBlocks; j++) {
    const l = blockZ[j]! > 0 ? toLufs(blockZ[j]!) : -Infinity;
    if (l > -70 && l > relGate) {
      sum += blockZ[j]!;
      n++;
    }
  }
  if (n === 0) return { lufs: -Infinity, samplePeak };
  return { lufs: toLufs(sum / n), samplePeak };
}

/** Scales every channel in place. */
export function applyGain(channels: Float32Array[], linear: number): void {
  for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * linear;
}

/**
 * Gains that level-match an A/B comparison. The louder side is turned DOWN to the
 * quieter one; nothing is ever boosted (a boost could clip the preview).
 * Non-finite loudness (silence, too-short audio) returns no change.
 */
export function matchGains(
  originalLufs: number,
  processedLufs: number,
  maxDb = 12,
): { dryDb: number; wetDb: number; diffDb: number } {
  if (!Number.isFinite(originalLufs) || !Number.isFinite(processedLufs)) {
    return { dryDb: 0, wetDb: 0, diffDb: 0 };
  }
  const diff = Math.max(-maxDb, Math.min(maxDb, processedLufs - originalLufs));
  return diff > 0
    ? { dryDb: 0, wetDb: -diff, diffDb: diff }
    : { dryDb: diff, wetDb: 0, diffDb: diff };
}

export const dbToLin = (db: number) => Math.pow(10, db / 20);
export const linToDb = (lin: number) => (lin > 0 ? 20 * Math.log10(lin) : -Infinity);

/**
 * Encodes PCM as a RIFF/WAVE file (16- or 24-bit integer). 16-bit gets TPDF dither.
 * Channels are interleaved; all channels must have equal length.
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bits: 16 | 24,
): Uint8Array<ArrayBuffer> {
  const nCh = channels.length;
  const len = channels[0]?.length ?? 0;
  const bytes = bits / 8;
  const dataSize = len * nCh * bytes;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, nCh, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * nCh * bytes, true);
  dv.setUint16(32, nCh * bytes, true);
  dv.setUint16(34, bits, true);
  w(36, "data");
  dv.setUint32(40, dataSize, true);

  let o = 44;
  if (bits === 16) {
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < nCh; c++) {
        const dither = Math.random() - Math.random(); // TPDF, ±1 LSB
        const v = Math.max(-1, Math.min(1, channels[c]![i]!)) * 32767 + dither;
        dv.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(v))), true);
        o += 2;
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < nCh; c++) {
        const v = Math.round(Math.max(-1, Math.min(1, channels[c]![i]!)) * 8388607);
        dv.setUint8(o, v & 0xff);
        dv.setUint8(o + 1, (v >> 8) & 0xff);
        dv.setUint8(o + 2, (v >> 16) & 0xff);
        o += 3;
      }
    }
  }
  return new Uint8Array(buf);
}

/* ------------------------------------------------------------------ */
/* True peak                                                           */
/* ------------------------------------------------------------------ */

const TP_TAPS = 12; // per phase, as in BS.1770's 4x oversampling filter
const TP_PHASES = [1, 2, 3] as const; // phase 0 is the original sample

/** Windowed-sinc interpolation coefficients for the three in-between phases. */
const TP_COEFFS: Float64Array[] = TP_PHASES.map((p) => {
  const c = new Float64Array(TP_TAPS);
  const frac = p / 4;
  for (let j = 0; j < TP_TAPS; j++) {
    const k = j - (TP_TAPS / 2 - 1); // -5 .. +6
    const x = k - frac;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w =
      0.42 +
      0.5 * Math.cos((Math.PI * x) / (TP_TAPS / 2)) +
      0.08 * Math.cos((2 * Math.PI * x) / (TP_TAPS / 2)); // Blackman
    c[j] = sinc * w;
  }
  return c;
});

/**
 * True peak: the highest level the reconstructed waveform reaches between samples, from a
 * 4x oversampled estimate. Always >= sample peak. Returns a linear value.
 * Regions well below the sample peak are skipped, since they cannot reach it.
 */
export function measureTruePeak(channels: Float32Array[]): number {
  let samplePeak = 0;
  for (const ch of channels)
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]!);
      if (v > samplePeak) samplePeak = v;
    }
  if (samplePeak === 0) return 0;

  const screen = samplePeak * 0.25;
  let peak = samplePeak;
  const half = TP_TAPS / 2;

  for (const ch of channels) {
    const n = ch.length;
    for (let i = half; i < n - half; i++) {
      // a window that never gets near the peak cannot produce an overshoot
      if (
        Math.abs(ch[i]!) < screen &&
        Math.abs(ch[i + 1]!) < screen &&
        Math.abs(ch[i - 1]!) < screen
      ) {
        continue;
      }
      for (let p = 0; p < 3; p++) {
        const c = TP_COEFFS[p]!;
        let acc = 0;
        const base = i - (half - 1);
        for (let j = 0; j < TP_TAPS; j++) acc += c[j]! * ch[base + j]!;
        const a = Math.abs(acc);
        if (a > peak) peak = a;
      }
    }
  }
  return peak;
}
