/**
 * The mastering signal chain. One class builds the same graph on a real-time
 * AudioContext (preview) and on an OfflineAudioContext (export), so what you
 * hear is what you download.
 *
 *   input → sub-cut HPF ─┬─ FULL path: low shelf → punch bell ───────────────┐
 *                        └─ BAND path: Linkwitz-Riley split @ crossover      │
 *                              low  → punch bell → level → saturate →        │
 *                                     compress → (mono) ─┐                   ├→ low-mid cut → air shelf
 *                              high ─────────────────────┴─ sum ─────────────┘     → glue comp → makeup gain
 *                                                                                  → limiter → output
 * Only one path is audible at a time (mode gains); both stay connected so
 * switching modes never rebuilds the graph or clicks.
 */

export type MasterMode = "full" | "band";

export type MasterParams = {
  mode: MasterMode;
  /** Low-shelf gain in FULL mode / low-band level in BAND mode. dB. */
  bassGainDb: number;
  /** Corner of the bass shelf (FULL) or crossover frequency (BAND). Hz. */
  crossoverHz: number;
  punchFreq: number;
  punchGainDb: number;
  punchQ: number;
  /** BAND mode only. 0–1. */
  warmth: number;
  /** BAND mode only. 0–1 low-band compression. */
  tighten: number;
  /** BAND mode only. Sum the low band to mono. */
  monoBass: boolean;
  /**
   * High-pass cutoff for true sub-rumble removal. 0 = off. Hz.
   * Keep at or below 40 Hz — this permanently removes energy.
   * For boomy Suno bass, use Band mode + Tighten instead.
   */
  subCutHz: number;
  /**
   * HPF order: 1 = 12 dB/oct (gentle); 2 = 24 dB/oct (steep, more aggressive cut).
   * Steeper slope removes more bass energy above the cutoff but rolls off faster.
   */
  subCutSlope: 1 | 2;
  /**
   * HPF resonance (Q). 0.5 = very smooth; 0.707 = Butterworth (no peak);
   * 1.2–2.0 = adds a slight boost at the cutoff that can add punch.
   */
  subCutQ: number;
  /** Bell cut at 250 Hz. dB, ≤ 0. */
  lowMidCutDb: number;
  /** High shelf at 10 kHz. dB. */
  airDb: number;
  /** Master bus compression amount. 0–1. */
  glue: number;
  /** Limiter ceiling. dBFS. */
  ceilingDb: number;
  /** Gain into the limiter. Set by the exporter to hit a loudness target. dB. */
  makeupDb: number;
  /** Sub-band compressor: dynamically ducks rumble below subCompFreq. 0 = off, 1 = max. */
  subCompAmount: number;
  /** Crossover for the sub compressor. Hz. */
  subCompFreq: number;
  /** Narrow EQ cut to reduce a specific rumble frequency. dB, ≤ 0. */
  subScoopDb: number;
  /** Center of the sub scoop. Hz. */
  subScoopFreq: number;
  /** Q of the sub scoop (higher = narrower). */
  subScoopQ: number;
  /** Solo the sub band for monitoring. */
  subSolo: boolean;
};

export const DEFAULT_PARAMS: MasterParams = {
  mode: "full",
  bassGainDb: 0,
  crossoverHz: 110,
  punchFreq: 70,
  punchGainDb: 0,
  punchQ: 1.2,
  warmth: 0,
  tighten: 0,
  monoBass: false,
  subCutHz: 0,
  subCutSlope: 1,
  subCutQ: 0.707,
  lowMidCutDb: 0,
  airDb: 0,
  glue: 0,
  ceilingDb: -1,
  makeupDb: 0,
  subCompAmount: 0,
  subCompFreq: 50,
  subScoopDb: 0,
  subScoopFreq: 32,
  subScoopQ: 3,
  subSolo: false,
};

export const PRESETS: Array<{ name: string; hint: string; params: Partial<MasterParams> }> = [
  { name: "Flat", hint: "Reset everything", params: { ...DEFAULT_PARAMS } },
  {
    name: "Suno rumble fix",
    hint: "Dedicated sub compressor targets rumble below 50 Hz without touching punch. Start here for muddy, vibrating Suno bass.",
    params: {
      mode: "band",
      crossoverHz: 100,
      bassGainDb: 0,
      punchFreq: 70,
      punchGainDb: 1.0,
      punchQ: 1.2,
      warmth: 0.2,
      tighten: 0.35,
      monoBass: true,
      subCompAmount: 0.7,
      subCompFreq: 50,
      subScoopDb: -3,
      subScoopFreq: 32,
      subScoopQ: 3,
      subCutHz: 25,
      subCutSlope: 1,
      subCutQ: 0.707,
      lowMidCutDb: -1.5,
      glue: 0.2,
      ceilingDb: -1,
    },
  },
  {
    name: "Suno sub tame",
    hint: "Dynamically compresses Suno's characteristic low-end boom — shapes and controls the bass without removing it.",
    params: {
      mode: "band",
      crossoverHz: 100,
      bassGainDb: 0,
      punchFreq: 80,
      punchGainDb: 1.0,
      punchQ: 1.3,
      warmth: 0.2,
      tighten: 0.65,
      monoBass: true,
      subCutHz: 30,
      subCutSlope: 1,
      subCutQ: 0.707,
      lowMidCutDb: -1.5,
      glue: 0.25,
      ceilingDb: -1,
    },
  },
  {
    name: "Suno deep clean",
    hint: "Maximum band compression for heavy Suno bass — aggressive tightening without cutting. Best for headphones and club monitoring.",
    params: {
      mode: "band",
      crossoverHz: 110,
      bassGainDb: -1,
      punchFreq: 90,
      punchGainDb: 1.5,
      punchQ: 1.4,
      warmth: 0.15,
      tighten: 0.8,
      monoBass: true,
      subCutHz: 30,
      subCutSlope: 1,
      subCutQ: 0.707,
      lowMidCutDb: -2,
      glue: 0.3,
      ceilingDb: -1,
    },
  },
  {
    name: "Streaming ready",
    hint: "Tightens and shapes bass for streaming without removing it. Targets –14 LUFS behaviour (Spotify, Apple Music, YouTube).",
    params: {
      mode: "band",
      crossoverHz: 120,
      bassGainDb: 0,
      punchFreq: 85,
      punchGainDb: 1.0,
      punchQ: 1.2,
      warmth: 0.35,
      tighten: 0.45,
      monoBass: true,
      subCutHz: 30,
      subCutSlope: 1,
      subCutQ: 0.707,
      lowMidCutDb: -1.5,
      airDb: 0.5,
      glue: 0.3,
      ceilingDb: -1,
    },
  },
  {
    name: "Tighter low end",
    hint: "Cut mud, rein in boom",
    params: {
      mode: "band",
      crossoverHz: 120,
      bassGainDb: -1,
      punchFreq: 90,
      punchGainDb: 1.5,
      punchQ: 1.4,
      tighten: 0.55,
      monoBass: true,
      subCutHz: 28,
      lowMidCutDb: -2,
    },
  },
  {
    name: "Warm & fat",
    hint: "Harmonics so bass reads on small speakers",
    params: {
      mode: "band",
      crossoverHz: 130,
      bassGainDb: 1.5,
      punchFreq: 80,
      punchGainDb: 2,
      punchQ: 1,
      warmth: 0.6,
      tighten: 0.3,
      monoBass: true,
      subCutHz: 25,
    },
  },
  {
    name: "Club sub boost",
    hint: "Weight below 80 Hz",
    params: {
      mode: "full",
      crossoverHz: 90,
      bassGainDb: 3.5,
      punchFreq: 55,
      punchGainDb: 2,
      punchQ: 1.1,
      subCutHz: 24,
      lowMidCutDb: -1.5,
      glue: 0.25,
    },
  },
  {
    name: "Clean up boxy mix",
    hint: "Less 250 Hz, a touch of air",
    params: {
      mode: "full",
      crossoverHz: 100,
      bassGainDb: 0,
      punchGainDb: 0,
      subCutHz: 30,
      lowMidCutDb: -3.5,
      airDb: 1.5,
    },
  },
];

const SMOOTH = 0.02; // seconds, parameter smoothing for live tweaks
const SAT_K = 2.5;

function satCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(SAT_K * x) / SAT_K; // unity slope at 0, rounds peaks
  }
  return c;
}

const dbLin = (db: number) => Math.pow(10, db / 20);

export class MasterChain {
  readonly input: GainNode;
  readonly output: GainNode;

  private readonly ctx: BaseAudioContext;
  private readonly realtime: boolean;

  private readonly subCut: BiquadFilterNode;
  /** Second HPF in series — enabled (same frequency) when subCutSlope === 2 for 24 dB/oct. */
  private readonly subCut2: BiquadFilterNode;
  // full path
  private readonly shelf: BiquadFilterNode;
  private readonly punchF: BiquadFilterNode;
  private readonly fullGain: GainNode;
  // band path
  private readonly lp1: BiquadFilterNode;
  private readonly lp2: BiquadFilterNode;
  private readonly hp1: BiquadFilterNode;
  private readonly hp2: BiquadFilterNode;
  private readonly punchB: BiquadFilterNode;
  private readonly level: GainNode;
  private readonly satDry: GainNode;
  private readonly satWet: GainNode;
  private readonly lowComp: DynamicsCompressorNode;
  private readonly stereoG: GainNode;
  private readonly monoIn: GainNode;
  private readonly monoG: GainNode;
  private readonly bandGain: GainNode;
  // post
  private readonly mud: BiquadFilterNode;
  private readonly air: BiquadFilterNode;
  private readonly glue: DynamicsCompressorNode;
  private readonly makeup: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly subScoop: BiquadFilterNode;
  private readonly subLP: BiquadFilterNode;
  private readonly subHP: BiquadFilterNode;
  private readonly subComp: DynamicsCompressorNode;
  private readonly subBypassGain: GainNode;
  private readonly subWetGain: GainNode;
  private readonly subHighGain: GainNode;
  private readonly subCompSum: GainNode;
  private readonly subSoloGain: GainNode;
  private readonly mainMute: GainNode;

  constructor(ctx: BaseAudioContext, params: MasterParams) {
    this.ctx = ctx;
    this.realtime = !("startRendering" in ctx);
    const bq = (type: BiquadFilterType) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      return f;
    };

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.subCut = bq("highpass");
    this.subCut.Q.value = 0.707;
    this.subCut2 = bq("highpass");
    this.subCut2.frequency.value = 1; // effectively flat until slope === 2
    this.subCut2.Q.value = 0.707;

    // ---- full path
    this.shelf = bq("lowshelf");
    this.punchF = bq("peaking");
    this.fullGain = ctx.createGain();

    // ---- band path (Linkwitz-Riley 4th order = two cascaded Butterworth)
    this.lp1 = bq("lowpass");
    this.lp2 = bq("lowpass");
    this.hp1 = bq("highpass");
    this.hp2 = bq("highpass");
    for (const f of [this.lp1, this.lp2, this.hp1, this.hp2]) f.Q.value = Math.SQRT1_2;
    this.punchB = bq("peaking");
    this.level = ctx.createGain();
    this.satDry = ctx.createGain();
    this.satWet = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = satCurve();
    shaper.oversample = "4x";
    const satSum = ctx.createGain();
    this.lowComp = ctx.createDynamicsCompressor();
    this.lowComp.knee.value = 6;
    this.lowComp.attack.value = 0.012;
    this.lowComp.release.value = 0.16;
    this.stereoG = ctx.createGain();
    this.monoIn = ctx.createGain();
    this.monoIn.channelCount = 1;
    this.monoIn.channelCountMode = "explicit";
    this.monoIn.channelInterpretation = "speakers"; // stereo → mono = (L+R)/2
    this.monoG = ctx.createGain();
    const lowSum = ctx.createGain();
    const bandSum = ctx.createGain();
    this.bandGain = ctx.createGain();

    // ---- post
    const bus = ctx.createGain();
    this.mud = bq("peaking");
    this.mud.frequency.value = 250;
    this.mud.Q.value = 1;
    this.air = bq("highshelf");
    this.air.frequency.value = 10000;
    this.glue = ctx.createDynamicsCompressor();
    this.glue.knee.value = 10;
    this.glue.attack.value = 0.03;
    this.glue.release.value = 0.25;
    this.makeup = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;

    // ---- sub processor (scoop + dedicated sub compressor + solo)
    this.subScoop = bq("peaking");
    this.subScoop.frequency.value = 32;
    this.subScoop.Q.value = 3;
    this.subLP = bq("lowpass");
    this.subLP.Q.value = 0.5;
    this.subHP = bq("highpass");
    this.subHP.Q.value = 0.5;
    this.subComp = ctx.createDynamicsCompressor();
    this.subComp.knee.value = 2;
    this.subComp.attack.value = 0.008;
    this.subComp.release.value = 0.1;
    this.subBypassGain = ctx.createGain();
    this.subWetGain = ctx.createGain();
    this.subHighGain = ctx.createGain();
    this.subCompSum = ctx.createGain();
    this.subSoloGain = ctx.createGain();
    this.subSoloGain.gain.value = 0;
    this.mainMute = ctx.createGain();
    this.mainMute.gain.value = 1;

    // ---- wiring
    // Two cascaded HPFs: subCut → subCut2.
    // When subCutSlope === 1, subCut2.frequency is held at 1 Hz (flat pass-through).
    // When subCutSlope === 2, subCut2 mirrors subCut's frequency for a 24 dB/oct slope.
    this.input.connect(this.subCut);
    this.subCut.connect(this.subCut2);

    this.subCut2.connect(this.subScoop);

    // Sub compressor: dry/wet crossfade around a sub-band split
    this.subScoop.connect(this.subBypassGain);
    this.subBypassGain.connect(this.subCompSum);
    this.subScoop.connect(this.subLP);
    this.subLP.connect(this.subComp);
    this.subLP.connect(this.subSoloGain);
    this.subSoloGain.connect(this.output);
    this.subComp.connect(this.subWetGain);
    this.subWetGain.connect(this.subCompSum);
    this.subScoop.connect(this.subHP);
    this.subHP.connect(this.subHighGain);
    this.subHighGain.connect(this.subCompSum);

    this.subCompSum.connect(this.shelf);
    this.shelf.connect(this.punchF);
    this.punchF.connect(this.fullGain);
    this.fullGain.connect(bus);

    this.subCompSum.connect(this.lp1);
    this.lp1.connect(this.lp2);
    this.lp2.connect(this.punchB);
    this.punchB.connect(this.level);
    this.level.connect(this.satDry);
    this.level.connect(shaper);
    shaper.connect(this.satWet);
    this.satDry.connect(satSum);
    this.satWet.connect(satSum);
    satSum.connect(this.lowComp);
    this.lowComp.connect(this.stereoG);
    this.lowComp.connect(this.monoIn);
    this.monoIn.connect(this.monoG);
    this.stereoG.connect(lowSum);
    this.monoG.connect(lowSum);
    lowSum.connect(bandSum);
    this.subCompSum.connect(this.hp1);
    this.hp1.connect(this.hp2);
    this.hp2.connect(bandSum);
    bandSum.connect(this.bandGain);
    this.bandGain.connect(bus);

    bus.connect(this.mud);
    this.mud.connect(this.air);
    this.air.connect(this.glue);
    this.glue.connect(this.makeup);
    this.makeup.connect(this.limiter);
    this.limiter.connect(this.mainMute);
    this.mainMute.connect(this.output);

    this.update(params, false);
  }

  /** Push new parameter values. `smooth` ramps them (live tweaking); offline renders set them instantly. */
  update(p: MasterParams, smooth = true): void {
    const t = this.ctx.currentTime;
    const set = (param: AudioParam, v: number) => {
      if (smooth && this.realtime) param.setTargetAtTime(v, t, SMOOTH);
      else param.value = v;
    };
    const full = p.mode === "full";

    const hpfHz = p.subCutHz > 0 ? p.subCutHz : 5;
    set(this.subCut.frequency, hpfHz);
    set(this.subCut.Q, p.subCutQ);
    // subCut2: active when slope === 2; otherwise park at 1 Hz (transparent)
    set(this.subCut2.frequency, p.subCutSlope === 2 ? hpfHz : 1);
    set(this.subCut2.Q, p.subCutQ);

    set(this.fullGain.gain, full ? 1 : 0);
    set(this.bandGain.gain, full ? 0 : 1);

    // full path
    set(this.shelf.frequency, p.crossoverHz);
    set(this.shelf.gain, p.bassGainDb);
    set(this.punchF.frequency, p.punchFreq);
    set(this.punchF.gain, p.punchGainDb);
    set(this.punchF.Q, p.punchQ);

    // band path
    for (const f of [this.lp1, this.lp2, this.hp1, this.hp2]) set(f.frequency, p.crossoverHz);
    set(this.punchB.frequency, p.punchFreq);
    set(this.punchB.gain, p.punchGainDb);
    set(this.punchB.Q, p.punchQ);
    set(this.level.gain, dbLin(p.bassGainDb));
    set(this.satWet.gain, p.warmth);
    set(this.satDry.gain, 1 - p.warmth);
    set(this.lowComp.threshold, -10 - p.tighten * 22);
    set(this.lowComp.ratio, 1 + p.tighten * 5);
    set(this.stereoG.gain, p.monoBass ? 0 : 1);
    set(this.monoG.gain, p.monoBass ? 1 : 0);

    // post
    set(this.mud.gain, Math.min(0, p.lowMidCutDb));
    set(this.air.gain, p.airDb);
    set(this.glue.threshold, -10 - p.glue * 12);
    set(this.glue.ratio, 1 + p.glue * 2.5);
    set(this.makeup.gain, dbLin(p.makeupDb));
    set(this.limiter.threshold, p.ceilingDb);

    // sub scoop
    set(this.subScoop.frequency, p.subScoopFreq);
    set(this.subScoop.gain, Math.min(0, p.subScoopDb));
    set(this.subScoop.Q, p.subScoopQ);

    // sub compressor
    set(this.subLP.frequency, p.subCompFreq);
    set(this.subHP.frequency, p.subCompFreq);
    set(this.subComp.threshold, -5 - p.subCompAmount * 20);
    set(this.subComp.ratio, 1 + p.subCompAmount * 8);
    set(this.subBypassGain.gain, 1 - p.subCompAmount);
    set(this.subWetGain.gain, p.subCompAmount);
    set(this.subHighGain.gain, p.subCompAmount);

    // sub solo (monitoring)
    set(this.mainMute.gain, p.subSolo ? 0 : 1);
    set(this.subSoloGain.gain, p.subSolo ? 1 : 0);
  }

  /**
   * Static EQ magnitude response (dB) at the given frequencies for the active
   * path. Ignores the dynamics (compressors, saturation) — it is the "EQ curve"
   * a plugin would draw.
   */
  responseDb(freqs: Float32Array<ArrayBuffer>, p: MasterParams): Float32Array {
    const n = freqs.length;
    const resp = (f: BiquadFilterNode) => {
      const mag = new Float32Array(n);
      const ph = new Float32Array(n);
      f.getFrequencyResponse(freqs, mag, ph);
      return { mag, ph };
    };
    const out = new Float32Array(n);
    const common = [this.subCut, this.subCut2, this.subScoop, this.mud, this.air].map(resp);
    const full = p.mode === "full";
    const fullPath = full ? [this.shelf, this.punchF].map(resp) : [];
    const lowPath = full ? [] : [this.lp1, this.lp2, this.punchB].map(resp);
    const highPath = full ? [] : [this.hp1, this.hp2].map(resp);
    const lowLevel = dbLin(p.bassGainDb);

    for (let i = 0; i < n; i++) {
      let magCommon = 1;
      for (const r of common) magCommon *= r.mag[i]!;

      let mag: number;
      if (full) {
        let m = 1;
        for (const r of fullPath) m *= r.mag[i]!;
        mag = m;
      } else {
        // complex sum of the two bands (they differ in phase around the crossover)
        let lm = lowLevel,
          lp = 0;
        for (const r of lowPath) {
          lm *= r.mag[i]!;
          lp += r.ph[i]!;
        }
        let hm = 1,
          hp = 0;
        for (const r of highPath) {
          hm *= r.mag[i]!;
          hp += r.ph[i]!;
        }
        const re = lm * Math.cos(lp) + hm * Math.cos(hp);
        const im = lm * Math.sin(lp) + hm * Math.sin(hp);
        mag = Math.hypot(re, im);
      }
      out[i] = 20 * Math.log10(Math.max(1e-6, mag * magCommon));
    }
    return out;
  }
}

/**
 * The middle `seconds` of a buffer (or the whole thing if it is shorter). Used to
 * estimate loudness cheaply instead of rendering a full song on every tweak.
 */
export function sliceBuffer(buffer: AudioBuffer, seconds: number): AudioBuffer {
  const len = Math.floor(seconds * buffer.sampleRate);
  if (buffer.length <= len) return buffer;
  const start = Math.floor((buffer.length - len) / 2);
  const out = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: len,
    sampleRate: buffer.sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).subarray(start, start + len), c);
  }
  return out;
}

/**
 * Renders `buffer` through the chain offline and returns the processed stereo PCM.
 * Always renders 2 channels (mono sources are upmixed).
 */
export async function renderMaster(
  buffer: AudioBuffer,
  params: MasterParams,
): Promise<Float32Array[]> {
  const off = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
  const chain = new MasterChain(off, params);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(chain.input);
  chain.output.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return [rendered.getChannelData(0), rendered.getChannelData(1)];
}
