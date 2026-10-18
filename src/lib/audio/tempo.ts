/**
 * Estimates a beat's tempo in the browser: an onset-strength envelope, then autocorrelation
 * over 70–180 BPM. Good for drum loops; less reliable on sparse or rubato material, so the
 * UI calls the result an estimate.
 */

const HOP = 512;

/** Positive changes in short-time energy: where hits happen. */
export function onsetEnvelope(mono: Float32Array, fs: number): { env: Float32Array; rate: number } {
  const frames = Math.floor(mono.length / HOP);
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) sum += mono[i]! * mono[i]!;
    energy[f] = Math.sqrt(sum / HOP);
  }
  const env = new Float32Array(frames);
  for (let f = 1; f < frames; f++) env[f] = Math.max(0, energy[f]! - energy[f - 1]!);
  return { env, rate: fs / HOP };
}

export function estimateBpm(mono: Float32Array, fs: number, min = 70, max = 180): number | null {
  const { env, rate } = onsetEnvelope(mono, fs);
  if (env.length < rate * 4) return null; // need at least ~4 seconds

  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  const centered = env.map((v) => v - mean);

  const scoreAt = (bpm: number): number => {
    const lag = (60 / bpm) * rate;
    let score = 0;
    // Sum correlation at 1, 2 and 4 beats so the bar pattern counts, not just one lag.
    for (const mult of [1, 2, 4]) {
      const l = lag * mult;
      const lo = Math.floor(l);
      const frac = l - lo;
      let s = 0;
      for (let i = 0; i + lo + 1 < centered.length; i++) {
        const shifted = centered[i + lo]! * (1 - frac) + centered[i + lo + 1]! * frac;
        s += centered[i]! * shifted;
      }
      score += s / mult;
    }
    return score;
  };

  let best = -Infinity;
  let bestBpm: number | null = null;
  // A pattern that fits 140 also fits 70 (every other beat). The usual remedy is a gentle
  // preference for tempos near 120 BPM, about one octave wide, which settles those ties.
  const prior = (bpm: number) => Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
  for (let bpm = min; bpm <= max; bpm += 0.5) {
    const score = scoreAt(bpm) * prior(bpm);
    if (score > best) {
      best = score;
      bestBpm = bpm;
    }
  }
  if (bestBpm === null || best <= 0) return null;
  return Math.round(bestBpm);
}
