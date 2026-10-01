/**
 * Average-spectrum analysis in 1/3-octave bands, and a bass-focused comparison against a
 * reference track. Pure (no Web Audio) so it is testable in node.
 */

export const BAND_CENTERS = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000,
] as const;

const FFT_SIZE = 8192;

/** In-place iterative radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Average power per 1/3-octave band (dB, arbitrary reference) over up to `maxSeconds`
 * taken from the middle of the audio. Channels are mixed to mono first.
 */
export function bandSpectrumDb(channels: Float32Array[], fs: number, maxSeconds = 60): number[] {
  const len = channels[0]?.length ?? 0;
  const want = Math.min(len, Math.floor(maxSeconds * fs));
  const start = Math.floor((len - want) / 2);
  const mono = new Float64Array(want);
  for (let i = 0; i < want; i++) {
    let s = 0;
    for (const ch of channels) s += ch[start + i]!;
    mono[i] = s / channels.length;
  }

  const bins = FFT_SIZE / 2;
  const power = new Float64Array(bins);
  const window = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE);

  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  let frames = 0;
  for (let pos = 0; pos + FFT_SIZE <= want; pos += FFT_SIZE / 2) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[pos + i]! * window[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) power[k]! += re[k]! * re[k]! + im[k]! * im[k]!;
    frames++;
  }
  if (frames === 0) return BAND_CENTERS.map(() => -120);

  const binHz = fs / FFT_SIZE;
  const edge = Math.pow(2, 1 / 6);
  return BAND_CENTERS.map((fc) => {
    const lo = fc / edge;
    const hi = fc * edge;
    let sum = 0;
    for (let k = Math.max(1, Math.ceil(lo / binHz)); k < bins && k * binHz < hi; k++)
      sum += power[k]!;
    return 10 * Math.log10(sum / frames + 1e-20);
  });
}

const idx = (hz: number) => BAND_CENTERS.indexOf(hz as (typeof BAND_CENTERS)[number]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Spectrum relative to the mid-range (250 Hz - 4 kHz), so loudness differences drop out. */
export function relativeSpectrum(db: number[]): number[] {
  const mids = mean(db.slice(idx(250), idx(4000) + 1));
  return db.map((x) => x - mids);
}

export type ReferenceAdvice = {
  /** Per-band difference, reference minus song (dB). Positive = the reference has more. */
  diffDb: number[];
  /** Suggested additional change on top of the current settings. */
  delta: {
    bassGainDb: number;
    lowMidCutDb: number;
    airDb: number;
    subCutHz: number | null;
  };
  lines: string[];
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const half = (x: number) => Math.round(x * 2) / 2;

/** Bass-first advice on how to move `song` toward `reference` (both band spectra in dB). */
export function adviseFromReference(songDb: number[], referenceDb: number[]): ReferenceAdvice {
  const s = relativeSpectrum(songDb);
  const r = relativeSpectrum(referenceDb);
  const diffDb = r.map((x, i) => x - s[i]!);

  const avg = (from: number, to: number) => mean(diffDb.slice(idx(from), idx(to) + 1));
  const bass = avg(40, 125);
  const sub = avg(25, 31.5);
  const lowMid = avg(200, 315);
  const air = avg(8000, 16000);

  const bassGainDb = Math.abs(bass) < 1 ? 0 : half(clamp(bass * 0.8, -9, 9));
  const lowMidCutDb = lowMid < -1.5 ? half(clamp(lowMid * 0.8, -6, 0)) : 0;
  const airDb = air > 1.5 ? half(clamp(air * 0.6, 0, 6)) : 0;
  const subCutHz = sub < -4 ? 28 : null;

  const lines: string[] = [];
  if (bassGainDb !== 0) {
    lines.push(
      bassGainDb > 0
        ? `Reference has about ${bass.toFixed(1)} dB more bass (40–125 Hz) relative to the mids — raise the bass by ${bassGainDb} dB.`
        : `Reference has about ${(-bass).toFixed(1)} dB less bass (40–125 Hz) relative to the mids — lower the bass by ${-bassGainDb} dB.`,
    );
  } else lines.push("Bass balance is already close to the reference.");
  if (subCutHz)
    lines.push(
      `Reference has much less below 32 Hz (${sub.toFixed(1)} dB) — add a sub cut at ${subCutHz} Hz.`,
    );
  if (lowMidCutDb !== 0)
    lines.push(
      `Reference is cleaner around 250 Hz (${lowMid.toFixed(1)} dB) — cut ${-lowMidCutDb} dB there.`,
    );
  if (airDb !== 0)
    lines.push(
      `Reference is brighter above 8 kHz (+${air.toFixed(1)} dB) — add ${airDb} dB of air.`,
    );

  return { diffDb, delta: { bassGainDb, lowMidCutDb, airDb, subCutHz }, lines };
}
