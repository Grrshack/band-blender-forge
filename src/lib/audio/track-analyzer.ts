/**
 * Offline frequency analysis for the AI mastering suggestion feature.
 *
 * Runs entirely in the browser using OfflineAudioContext bandpass renders —
 * no audio data ever leaves the tab.
 *
 * Strategy
 * ────────
 * 1. Mix the decoded AudioBuffer to mono and trim to the first 30 s.
 * 2. Run 13 parallel offline renders (6 broad bands + 7 sub narrow-bands).
 * 3. Compute RMS of each render output to quantify energy in that range.
 * 4. Express broad-band energies as dB relative to full-range RMS so the AI
 *    sees frequency balance rather than absolute level.
 * 5. Pick the sub narrow-band with the highest RMS as `lowPeakHz`.
 */

export interface TrackAnalysis {
  /** Full-range peak level in dBFS. */
  peakDb: number;
  /** Full-range RMS level in dBFS. */
  rmsDb: number;
  /** Crest factor: peakDb − rmsDb. Typical music: 6–20 dB. */
  dynamicRangeDb: number;
  /**
   * Most energetic sub-frequency in Hz, chosen from the 7 narrow probe bands.
   * Useful for aligning the punch bell to the kick/bass fundamental.
   */
  lowPeakHz: number;
  /**
   * Band energy in dB relative to the track's full-range RMS.
   * 0 dB means the band matches the average; negative = quieter; positive = louder.
   */
  bands: {
    sub: number;     // 20–80 Hz
    bass: number;    // 80–250 Hz
    lowMid: number;  // 250–500 Hz
    mid: number;     // 500–2 000 Hz
    highMid: number; // 2 000–8 000 Hz
    air: number;     // 8 000–20 000 Hz
  };
  /** Seconds actually analyzed (≤ 30). */
  analyzedSeconds: number;
}

// ────────── constants ──────────────────────────────────────────────────────────

const MAX_SECONDS = 30;

/** Centers of the 7 narrow probe bands used to find the dominant sub frequency. */
const SUB_CENTERS_HZ = [28, 50, 70, 90, 120, 165, 210] as const;

// ────────── helpers ────────────────────────────────────────────────────────────

function mixMono(buffer: AudioBuffer): Float32Array {
  const nCh = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < nCh; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i]! / nCh;
  }
  return mono;
}

function rmsOf(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
  return Math.sqrt(sum / data.length);
}

function linToDb(lin: number): number {
  return 20 * Math.log10(Math.max(lin, 1e-10));
}

function peakOf(data: Float32Array): number {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]!);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Render `mono` through a highpass (+ optional lowpass) chain offline
 * and return the RMS of the output.
 *
 * `lpHz` defaults to just below Nyquist (i.e. air band has no LP).
 */
async function bandRms(
  mono: Float32Array,
  sampleRate: number,
  hpHz: number,
  lpHz: number,
): Promise<number> {
  const ctx = new OfflineAudioContext(1, mono.length, sampleRate);
  const buf = ctx.createBuffer(1, mono.length, sampleRate);
  buf.copyToChannel(mono, 0);

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = Math.max(1, hpHz);
  hp.Q.value = 0.707;

  const nyq = sampleRate / 2;
  if (lpHz < nyq * 0.98) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(lpHz, nyq * 0.97);
    lp.Q.value = 0.707;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(ctx.destination);
  } else {
    src.connect(hp);
    hp.connect(ctx.destination);
  }

  src.start(0);
  const rendered = await ctx.startRendering();
  return rmsOf(rendered.getChannelData(0));
}

/**
 * Render `mono` through a narrow bandpass at `centerHz` and return the RMS.
 * Used to identify the dominant sub frequency.
 */
async function narrowBandRms(
  mono: Float32Array,
  sampleRate: number,
  centerHz: number,
): Promise<number> {
  const ctx = new OfflineAudioContext(1, mono.length, sampleRate);
  const buf = ctx.createBuffer(1, mono.length, sampleRate);
  buf.copyToChannel(mono, 0);

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centerHz;
  bp.Q.value = 2.5; // narrow enough to distinguish adjacent sub bands

  src.connect(bp);
  bp.connect(ctx.destination);
  src.start(0);
  const rendered = await ctx.startRendering();
  return rmsOf(rendered.getChannelData(0));
}

// ────────── public API ─────────────────────────────────────────────────────────

/**
 * Analyze the frequency balance and dynamics of a decoded audio buffer.
 * Analyzes the first 30 seconds. Returns a plain object that can be sent
 * straight to the AI as a JSON payload.
 */
export async function analyzeTrack(buffer: AudioBuffer): Promise<TrackAnalysis> {
  const fs = buffer.sampleRate;
  const nyq = fs / 2;

  // Trim to first MAX_SECONDS
  const maxLen = Math.floor(MAX_SECONDS * fs);
  let analysisBuffer: AudioBuffer;
  if (buffer.length > maxLen) {
    analysisBuffer = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: maxLen,
      sampleRate: fs,
    });
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      analysisBuffer.copyToChannel(buffer.getChannelData(c).subarray(0, maxLen), c);
    }
  } else {
    analysisBuffer = buffer;
  }

  const mono = mixMono(analysisBuffer);
  const analyzedSeconds = analysisBuffer.length / fs;

  // Raw stats from the mono PCM
  const peak = peakOf(mono);
  const rmsAll = rmsOf(mono);
  const peakDb = linToDb(peak);
  const rmsDb = linToDb(rmsAll);
  const dynamicRangeDb = peakDb - rmsDb;

  // Broad band boundaries
  const bandDefs: Array<[number, number]> = [
    [20, 80],
    [80, 250],
    [250, 500],
    [500, 2000],
    [2000, 8000],
    [8000, nyq],
  ];

  // Run all renders in parallel
  const [broadBands, subBands] = await Promise.all([
    Promise.all(bandDefs.map(([hp, lp]) => bandRms(mono, fs, hp, lp))),
    Promise.all(SUB_CENTERS_HZ.map((c) => narrowBandRms(mono, fs, c))),
  ]);

  // Express broad bands as dB relative to full-range RMS
  const relDb = (bandLinRms: number) => linToDb(bandLinRms / Math.max(rmsAll, 1e-10));

  const [subRms, bassRms, lowMidRms, midRms, highMidRms, airRms] = broadBands as number[];

  // Find dominant sub frequency
  let maxSubEnergy = -Infinity;
  let lowPeakHz: number = SUB_CENTERS_HZ[0];
  for (let i = 0; i < subBands.length; i++) {
    if (subBands[i]! > maxSubEnergy) {
      maxSubEnergy = subBands[i]!;
      lowPeakHz = SUB_CENTERS_HZ[i]!;
    }
  }

  return {
    peakDb: Math.round(peakDb * 10) / 10,
    rmsDb: Math.round(rmsDb * 10) / 10,
    dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
    lowPeakHz,
    bands: {
      sub: Math.round(relDb(subRms!) * 10) / 10,
      bass: Math.round(relDb(bassRms!) * 10) / 10,
      lowMid: Math.round(relDb(lowMidRms!) * 10) / 10,
      mid: Math.round(relDb(midRms!) * 10) / 10,
      highMid: Math.round(relDb(highMidRms!) * 10) / 10,
      air: Math.round(relDb(airRms!) * 10) / 10,
    },
    analyzedSeconds: Math.round(analyzedSeconds * 10) / 10,
  };
}
