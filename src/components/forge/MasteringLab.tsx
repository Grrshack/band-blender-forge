import {
  AudioWaveform,
  Download,
  FileAudio,
  ChevronDown,
  Headphones,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { ReferenceMatch } from "./ReferenceMatch";
import { useSettings } from "./settings";
import { useForge } from "./use-forge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PARAMS,
  MasterChain,
  PRESETS,
  STEM_OPTIONS,
  type StemType,
  renderMaster,
  sliceBuffer,
  type MasterParams,
} from "@/lib/audio/mastering-chain";
import { analyzeTrack, type TrackAnalysis } from "@/lib/audio/track-analyzer";
import { measureBuffer, type TakeMeasurements } from "@/lib/audio/take-diagnosis";
import { masteringVerdict } from "@/lib/audio/mastering-verdict";
import { MasteringScope } from "./MasteringScope";
import {
  applyGain,
  dbToLin,
  encodeWav,
  linToDb,
  matchGains,
  measureLoudness,
  measureTruePeak,
} from "@/lib/audio/mastering-dsp";
import { cn } from "@/lib/utils";
import { track } from "@/lib/stats";

const MAX_FILE_MB = 250;
const FMIN = 20;
const FMAX = 20000;

type Suggestion = {
  preset: string;
  adjustments: Partial<MasterParams>;
  reasoning: string;
  warnings: string[];
};

type Song = { name: string; size: number; buffer: AudioBuffer };
type Result = { lufs: number; truePeakDb: number; makeupDb: number; bits: number; file: string };
type Audio = {
  ctx: AudioContext;
  chain: MasterChain;
  dry: GainNode;
  wet: GainNode;
  analyser: AnalyserNode;
};

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
const fmtDb = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)} dB`;
const tick = () => new Promise<void>((r) => setTimeout(r, 30)); // let React paint between heavy steps

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "pointer-events-none opacity-40")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-xs text-accent">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled ?? false}
        onValueChange={(v) => onChange(v[0]!)}
        aria-label={label}
      />
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type GroupId = "bass" | "lowband" | "sub" | "finish";
const ALL_GROUPS: GroupId[] = ["bass", "lowband", "sub", "finish"];

/**
 * A control group that starts closed. The closed header still shows the current settings
 * and a dot when the group is doing something, so nobody forgets it's there.
 */
function Group({
  id,
  title,
  summary,
  active,
  open,
  onToggle,
  children,
  dim,
}: {
  id: GroupId;
  title: string;
  summary: string;
  active: boolean;
  open: boolean;
  onToggle: (id: GroupId) => void;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      id={`master-group-${id}`}
      className={cn("rounded-lg border bg-card/50", open ? "border-primary/40" : "border-border", dim && "opacity-60")}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`master-group-body-${id}`}
        className="flex w-full items-start gap-2.5 p-3.5 text-left"
      >
        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {active ? (
              <span className="flex items-center gap-1 text-[10px] font-normal text-signal-high">
                <span className="size-1.5 rounded-full bg-signal-high" /> in use
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="shrink-0 text-xs text-primary">{open ? "Close" : "Adjust"}</span>
      </button>
      {open ? (
        <div id={`master-group-body-${id}`} className="space-y-3.5 border-t border-border/60 p-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MasteringLab({ onOpenFix }: { onOpenFix?: () => void } = {}) {
  const [song, setSong] = useState<Song | null>(null);
  const [params, setParams] = useState<MasterParams>(DEFAULT_PARAMS);
  const [target, setTarget] = useState<string>("off");
  const [bits, setBits] = useState<"16" | "24">("24");
  const [autoClear, setAutoClear] = useState(true);

  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [matchOn, setMatchOn] = useState(true);
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<{ dryDb: number; wetDb: number; diffDb: number } | null>(null);
  const [position, setPosition] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI suggestion state
  const { apiKey, routing } = useSettings();
  const forge = useForge();
  const [suggesting, setSuggesting] = useState<string | null>(null); // step label while working
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestIntent, setSuggestIntent] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [stem, setStem] = useState<StemType>("mix");
  const [measured, setMeasured] = useState<TakeMeasurements | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const verdict = useMemo(() => (measured ? masteringVerdict(measured, stem) : null), [measured, stem]);

  // Measure each newly loaded song once, for the verdict at the top of the tab.
  useEffect(() => {
    setMeasured(null);
    if (!song) return;
    let alive = true;
    setMeasuring(true);
    measureBuffer(song.buffer)
      .then((m) => {
        if (alive) setMeasured(m);
      })
      .catch(() => {
        /* the verdict is optional; mastering still works */
      })
      .finally(() => {
        if (alive) setMeasuring(false);
      });
    return () => {
      alive = false;
    };
  }, [song]);

  // Detail groups start closed; "Show all controls" is remembered on this device.
  const [openGroups, setOpenGroups] = useState<Set<GroupId>>(new Set());
  useEffect(() => {
    try {
      if (localStorage.getItem("blf.master.allOpen") === "1") setOpenGroups(new Set(ALL_GROUPS));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const rememberAll = (all: boolean) => {
    try {
      localStorage.setItem("blf.master.allOpen", all ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };
  const toggleGroup = (id: GroupId) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openGroup = (id: GroupId) => {
    setOpenGroups((prev) => new Set(prev).add(id));
    setTimeout(
      () => document.getElementById(`master-group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
  };
  const allOpen = openGroups.size === ALL_GROUPS.length;

  const applyPresetByName = (name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    if (p.stem && p.stem !== stem) setStem(p.stem);
    setParams((prev) => ({ ...DEFAULT_PARAMS, ...p.params, makeupDb: prev.makeupDb }));
    setActivePreset(p.name);
  };
  const presetsForStem = PRESETS.filter(
    (p) => p.name === "Flat" || (stem === "mix" ? !p.stem : p.stem === stem),
  );

  const audioRef = useRef<Audio | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const paramsRef = useRef(params);
  const songRef = useRef<Song | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const origLoudnessRef = useRef<{ song: Song; lufs: number } | null>(null);

  paramsRef.current = params;
  songRef.current = song;

  const patch = (p: Partial<MasterParams>) => setParams((prev) => ({ ...prev, ...p }));

  const curveFreqs = useMemo(() => {
    const n = 180;
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = FMIN * Math.pow(FMAX / FMIN, i / (n - 1));
    return f;
  }, []);

  /* ---------- audio graph (created lazily on first user gesture) ---------- */

  const ensureAudio = useCallback((): Audio => {
    if (audioRef.current) return audioRef.current;
    const ctx = new AudioContext();
    const chain = new MasterChain(ctx, paramsRef.current);
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.82;
    chain.output.connect(wet);
    wet.connect(analyser);
    dry.connect(analyser);
    analyser.connect(ctx.destination);
    audioRef.current = { ctx, chain, dry, wet, analyser };
    return audioRef.current;
  }, []);

  const stopSource = useCallback(() => {
    const s = srcRef.current;
    srcRef.current = null;
    if (!s) return;
    s.onended = null;
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
    s.disconnect();
  }, []);

  const currentPosition = useCallback(() => {
    const a = audioRef.current;
    if (!a || !srcRef.current) return offsetRef.current;
    return a.ctx.currentTime - startedAtRef.current;
  }, []);

  const play = useCallback(
    async (from?: number) => {
      const s = songRef.current;
      if (!s) return;
      const a = ensureAudio();
      await a.ctx.resume();
      stopSource();
      const start = Math.min(Math.max(0, from ?? offsetRef.current), s.buffer.duration - 0.01);
      const src = a.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.connect(a.chain.input);
      src.connect(a.dry);
      src.start(0, start);
      srcRef.current = src;
      offsetRef.current = start;
      startedAtRef.current = a.ctx.currentTime - start;
      setPlaying(true);
    },
    [ensureAudio, stopSource],
  );

  const pause = useCallback(() => {
    offsetRef.current = currentPosition();
    stopSource();
    setPlaying(false);
  }, [currentPosition, stopSource]);

  const clearSong = useCallback(() => {
    stopSource();
    offsetRef.current = 0;
    setPlaying(false);
    setPosition(0);
    setSong(null); // drops the only reference to the decoded audio → garbage-collectable
    if (inputRef.current) inputRef.current.value = "";
  }, [stopSource]);

  /* ---------- keep the live chain in sync with the controls ---------- */

  useEffect(() => {
    audioRef.current?.chain.update(params);
  }, [params]);

  // Level-match the A/B: measure a 30 s excerpt of the original and of the processed
  // version (debounced while sliders move), then lower whichever is louder.
  useEffect(() => {
    if (!song || !matchOn) {
      setMatch(null);
      setMatching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMatching(true);
      try {
        const excerpt = sliceBuffer(song.buffer, 30);
        const fs = excerpt.sampleRate;
        if (origLoudnessRef.current?.song !== song) {
          const left = excerpt.getChannelData(0);
          const right = excerpt.getChannelData(excerpt.numberOfChannels > 1 ? 1 : 0);
          origLoudnessRef.current = { song, lufs: measureLoudness([left, right], fs).lufs };
        }
        const pcm = await renderMaster(excerpt, { ...params, makeupDb: 0 });
        if (cancelled) return;
        setMatch(matchGains(origLoudnessRef.current.lufs, measureLoudness(pcm, fs).lufs));
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setMatching(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [song, params, matchOn]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.ctx.currentTime;
    const dryDb = matchOn && match ? match.dryDb : 0;
    const wetDb = matchOn && match ? match.wetDb : 0;
    a.dry.gain.setTargetAtTime(bypass ? dbToLin(dryDb) : 0, t, 0.05);
    a.wet.gain.setTargetAtTime(bypass ? 0 : dbToLin(wetDb), t, 0.05);
  }, [bypass, matchOn, match, song]);

  const matchStatus = !matchOn
    ? "off — the louder one will sound better"
    : matching || !match
      ? "measuring…"
      : Math.abs(match.diffDb) < 0.3
        ? "already level-matched"
        : match.diffDb > 0
          ? `mastered is ${match.diffDb.toFixed(1)} LU louder — turned down to match`
          : `original is ${(-match.diffDb).toFixed(1)} LU louder — turned down to match`;

  /* ---------- spectrum + EQ curve ---------- */

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);

    const css = getComputedStyle(cv);
    const brand = css.getPropertyValue("--brand").trim() || "#3B5BFF";
    const violet = css.getPropertyValue("--violet").trim() || "#A855F7";
    const grid = css.getPropertyValue("--border").trim() || "#444";
    const muted = css.getPropertyValue("--muted-foreground").trim() || "#999";

    const xOf = (f: number) => (Math.log10(f / FMIN) / Math.log10(FMAX / FMIN)) * w;

    // grid + labels
    g.lineWidth = 1;
    g.font = `${10 * dpr}px ui-monospace, monospace`;
    g.textBaseline = "bottom";
    for (const f of [30, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      const x = Math.round(xOf(f)) + 0.5;
      g.strokeStyle = grid;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
      g.globalAlpha = 0.9;
      g.fillStyle = muted;
      g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3 * dpr, h - 3 * dpr);
    }
    // 0 dB line for the EQ curve
    g.globalAlpha = 0.6;
    g.strokeStyle = grid;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();

    // live spectrum
    const a = audioRef.current;
    if (a) {
      const bins = new Float32Array(a.analyser.frequencyBinCount);
      a.analyser.getFloatFrequencyData(bins);
      const nyq = a.ctx.sampleRate / 2;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) {
        const f = FMIN * Math.pow(FMAX / FMIN, x / w);
        const db = bins[Math.min(bins.length - 1, Math.round((f / nyq) * bins.length))] ?? -100;
        const y = h * (1 - Math.min(1, Math.max(0, (db + 100) / 90)));
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.globalAlpha = 0.28;
      g.fillStyle = brand;
      g.fill();
    }

    // EQ curve (static response of the active path), ±15 dB
    if (a) {
      const db = a.chain.responseDb(curveFreqs, paramsRef.current);
      g.beginPath();
      for (let i = 0; i < curveFreqs.length; i++) {
        const x = xOf(curveFreqs[i]!);
        const y = h / 2 - (Math.max(-15, Math.min(15, db[i]!)) / 15) * (h / 2) * 0.92;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.globalAlpha = 1;
      g.lineWidth = 2 * dpr;
      g.strokeStyle = violet;
      g.stroke();
    }
    g.globalAlpha = 1;
  }, [curveFreqs]);

  // animation loop while playing; single redraw when idle and something changed
  useEffect(() => {
    if (!playing) {
      draw();
      return;
    }
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const s = songRef.current;
      const pos = currentPosition();
      if (s && pos >= s.buffer.duration) {
        stopSource();
        offsetRef.current = 0;
        setPlaying(false);
        setPosition(0);
        return;
      }
      if (t - last > 66) {
        setPosition(pos);
        last = t;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw, currentPosition, stopSource]);

  useEffect(() => {
    if (!playing) draw();
  }, [params, song, playing, draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // release audio hardware + memory when leaving the tab
  useEffect(
    () => () => {
      stopSource();
      void audioRef.current?.ctx.close();
      audioRef.current = null;
    },
    [stopSource],
  );

  /* ---------- import ---------- */

  const loadFile = async (file: File) => {
    setError(null);
    setResult(null);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(
        `That file is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_FILE_MB} MB.`,
      );
      return;
    }
    setLoading(true);
    try {
      pause();
      offsetRef.current = 0;
      const a = ensureAudio();
      const buffer = await a.ctx.decodeAudioData(await file.arrayBuffer());
      setSong({ name: file.name, size: file.size, buffer });
      track("master_loaded", stem);
      setPosition(0);
    } catch {
      setError(
        "This browser couldn't decode that file. WAV, MP3, FLAC, M4A and OGG usually work — try exporting the track as WAV.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------- export ---------- */

  const exportMaster = async () => {
    const s = song;
    if (!s) return;
    track("master_export", stem);
    setError(null);
    setResult(null);
    pause();
    try {
      const fs = s.buffer.sampleRate;
      setExporting("Rendering…");
      await tick();
      let pcm = await renderMaster(s.buffer, { ...params, makeupDb: 0 });
      let makeupDb = 0;

      if (target !== "off") {
        setExporting("Measuring loudness…");
        await tick();
        const first = measureLoudness(pcm, fs);
        if (Number.isFinite(first.lufs)) {
          makeupDb = Math.max(-12, Math.min(18, Number(target) - first.lufs));
          setExporting(`Re-rendering with ${fmtDb(makeupDb)} into the limiter…`);
          await tick();
          pcm = await renderMaster(s.buffer, { ...params, makeupDb });
        }
      }

      setExporting("Checking true peak…");
      await tick();
      const ceiling = dbToLin(params.ceilingDb);
      let m = measureLoudness(pcm, fs);
      let truePeak = measureTruePeak(pcm);
      if (truePeak > ceiling) {
        // the limiter can overshoot, and the waveform can peak between samples; pull it under the ceiling
        applyGain(pcm, ceiling / truePeak);
        m = measureLoudness(pcm, fs);
        truePeak = measureTruePeak(pcm);
      }

      setExporting("Encoding WAV…");
      await tick();
      const bitDepth = bits === "16" ? 16 : 24;
      const wav = encodeWav(pcm, fs, bitDepth);
      const base = s.name.replace(/\.[^.]+$/, "") || "track";
      const file = `${base}-mastered.wav`;
      const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setResult({ lufs: m.lufs, truePeakDb: linToDb(truePeak), makeupDb, bits: bitDepth, file });
      if (autoClear) clearSong();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const settingsText = [
    `Mode: ${params.mode === "full" ? "Full-range EQ" : `Low band only (crossover ${params.crossoverHz} Hz)`}`,
    `Bass ${params.mode === "full" ? "shelf" : "level"}: ${fmtDb(params.bassGainDb)} @ ${params.crossoverHz} Hz`,
    `Punch bell: ${fmtDb(params.punchGainDb)} @ ${params.punchFreq} Hz, Q ${params.punchQ.toFixed(1)}`,
    params.mode === "band"
      ? `Warmth ${Math.round(params.warmth * 100)}%, tighten ${Math.round(params.tighten * 100)}%, mono bass ${params.monoBass ? "on" : "off"}`
      : "",
    params.subCutHz
      ? `High-pass: ${params.subCutHz} Hz, ${params.subCutSlope === 2 ? "−24 dB/oct (steep)" : "−12 dB/oct (gentle)"}, Q ${params.subCutQ.toFixed(2)}`
      : "High-pass: off",
    params.subCompAmount > 0
      ? `Sub compressor: ${Math.round(params.subCompAmount * 100)}% @ ${params.subCompFreq} Hz`
      : "Sub compressor: off",
    params.subScoopDb < 0
      ? `Sub scoop: ${fmtDb(params.subScoopDb)} @ ${params.subScoopFreq} Hz, Q ${params.subScoopQ.toFixed(1)}`
      : "Sub scoop: off",
    `Low-mid cut @ 250 Hz: ${fmtDb(params.lowMidCutDb)}`,
    `Air shelf @ 10 kHz: ${fmtDb(params.airDb)}`,
    `Glue compression: ${Math.round(params.glue * 100)}%`,
    `Limiter ceiling: ${params.ceilingDb.toFixed(1)} dBFS`,
  ]
    .filter(Boolean)
    .join("\n");

  /* ---------- AI mastering suggestion ---------- */

  const analyzeAndSuggest = async () => {
    if (!song) return;
    setSuggestError(null);
    setSuggestion(null);
    try {
      setSuggesting("Analyzing frequency balance…");
      const analysis: TrackAnalysis = await analyzeTrack(song.buffer);

      setSuggesting("Asking AI for settings…");
      const res = await forge({
        data: {
          task: "masterSuggest",
          routing,
          ...(apiKey ? { apiKey } : {}),
          payload: {
            analysis,
            ...(suggestIntent.trim() ? { intent: suggestIntent.trim() } : {}),
            stem,
          },
        },
      });

      const raw = JSON.parse(res.json) as {
        preset?: string;
        adjustments?: Record<string, unknown>;
        reasoning?: string;
        warnings?: unknown[];
      };

      const presetName = typeof raw.preset === "string" ? raw.preset : "Flat";
      const adjustments = raw.adjustments && typeof raw.adjustments === "object" ? raw.adjustments : {};
      const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "";
      const warnings = Array.isArray(raw.warnings)
        ? raw.warnings.filter((w): w is string => typeof w === "string")
        : [];

      setSuggestion({
        preset: presetName,
        adjustments: adjustments as Partial<MasterParams>,
        reasoning,
        warnings,
      });
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Analysis failed. Try again.");
    } finally {
      setSuggesting(null);
    }
  };

  const applySuggestion = (s: Suggestion) => {
    const preset = PRESETS.find((p) => p.name === s.preset);
    const base = preset ? { ...DEFAULT_PARAMS, ...preset.params } : { ...DEFAULT_PARAMS };
    // Merge AI adjustments; always preserve user's current makeupDb
    const merged: MasterParams = {
      ...base,
      ...s.adjustments,
      makeupDb: params.makeupDb,
    };
    // Safety clamp: never allow AI to set subCutHz above 40
    if (merged.subCutHz > 40) merged.subCutHz = 40;
    setParams(merged);
    setActivePreset(s.preset);
    setSuggestion(null);
  };

  const band = params.mode === "band";
  const noSong = !song;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const groupInfo: Record<GroupId, { summary: string; active: boolean }> = {
    bass: {
      summary: `${band ? "Low band" : "Bass shelf"} ${fmtDb(params.bassGainDb)} at ${params.crossoverHz} Hz · punch ${fmtDb(params.punchGainDb)} at ${params.punchFreq} Hz`,
      active: params.bassGainDb !== 0 || params.punchGainDb !== 0,
    },
    lowband: {
      summary: band
        ? `Warmth ${pct(params.warmth)} · tighten ${pct(params.tighten)} · mono bass ${params.monoBass ? "on" : "off"}`
        : "Only works in Low band mode (above)",
      active: band && (params.warmth > 0 || params.tighten > 0 || params.monoBass),
    },
    sub: {
      summary:
        params.subCompAmount > 0 || params.subScoopDb < 0
          ? `Sub compressor ${params.subCompAmount ? pct(params.subCompAmount) : "off"} · scoop ${fmtDb(params.subScoopDb)} at ${params.subScoopFreq} Hz`
          : "Off",
      active: params.subCompAmount > 0 || params.subScoopDb < 0,
    },
    finish: {
      summary: `Rumble cut ${params.subCutHz ? `${params.subCutHz} Hz` : "off"} · mud ${fmtDb(params.lowMidCutDb)} · air ${fmtDb(params.airDb)} · glue ${pct(params.glue)} · ceiling ${params.ceilingDb.toFixed(1)} dBFS`,
      active:
        params.subCutHz > 0 || params.lowMidCutDb < 0 || params.airDb > 0 || params.glue > 0,
    },
  };
  const groupProps = (id: GroupId) => ({
    id,
    summary: groupInfo[id].summary,
    active: groupInfo[id].active,
    open: openGroups.has(id),
    onToggle: toggleGroup,
  });

  return (
    <div className="space-y-5">
    <MasteringScope
      songName={song?.name ?? null}
      verdict={verdict}
      measuring={measuring}
      onApplyPreset={applyPresetByName}
      onShowControls={(g) => openGroup(g)}
      onOpenFix={onOpenFix}
    />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* ---------------- controls ---------------- */}
      <Panel
        title="Mastering Lab"
        subtitle="EQ and loudness for a finished song or a single stem. Runs in your browser."
        action={<CopyButton value={settingsText} label="Copy settings" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["full", "Full-range EQ", "Whole file. Use this for a bass stem too."],
                ["band", "Low band only", "Split at the crossover; only the lows are processed."],
              ] as const
            ).map(([mode, title, desc]) => (
              <button
                key={mode}
                type="button"
                onClick={() => patch({ mode })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  params.mode === mode
                    ? "glow-primary border-primary/60 bg-primary/10"
                    : "border-border bg-card/50 hover:border-primary/40",
                )}
              >
                <span className="block font-display text-xs font-semibold tracking-wide">
                  {title}
                </span>
                <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                  {desc}
                </span>
              </button>
            ))}
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-foreground/90">
              What did you load?
            </span>
            <div role="radiogroup" aria-label="What did you load?" className="flex flex-wrap gap-1.5">
              {STEM_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={stem === o.value}
                  onClick={() => {
                    setStem(o.value);
                    setActivePreset(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    stem === o.value
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {stem !== "mix" ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Stem mode: presets and AI Suggest are tuned for one instrument. Export it and drop it
                back into your mix or Suno project.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {presetsForStem.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setParams((prev) => ({ ...DEFAULT_PARAMS, ...p.params, makeupDb: prev.makeupDb }));
                    setActivePreset(p.name);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase transition-all",
                    activePreset === p.name
                      ? "glow-primary border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:border-accent/60 hover:text-accent",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {activePreset ? (
              <p className="pl-1 text-[10px] leading-snug text-muted-foreground">
                {PRESETS.find((p) => p.name === activePreset)?.hint}
              </p>
            ) : null}
          </div>

          {/* ── AI Suggestion panel ── */}
          <div className="rounded-lg border border-border bg-card/50 p-3.5 space-y-3">
            <div>
              <h3 className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
                AI Suggest
              </h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Analyzes frequency balance locally, then asks the AI to recommend settings. No audio uploaded.
              </p>
            </div>

            <Textarea
              value={suggestIntent}
              onChange={(e) => setSuggestIntent(e.target.value)}
              rows={2}
              placeholder="What are you going for? e.g. 'punchier kick', 'less boomy bass', 'warmer overall' — optional"
              className="resize-none border-border bg-card/60 font-mono text-[11px] placeholder:text-muted-foreground/50 focus-visible:ring-primary"
            />

            <Button
              size="sm"
              variant="outline"
              disabled={noSong || !!suggesting}
              onClick={() => void analyzeAndSuggest()}
              className="w-full h-8 gap-1.5 font-mono text-[10px] tracking-wider border-primary/40 text-primary hover:border-primary hover:bg-primary/10"
            >
              {suggesting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              {suggesting ?? "Analyze & Suggest"}
            </Button>

            {suggestError ? (
              <p className="text-[10px] text-destructive">{suggestError}</p>
            ) : null}

            {suggestion ? (
              <div className="space-y-2.5 rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                      Recommended preset
                    </p>
                    <p className="font-display text-sm font-semibold text-primary">
                      {suggestion.preset}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => applySuggestion(suggestion)}
                    className="shrink-0 h-7 gap-1 font-mono text-[10px] tracking-wider glow-primary"
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/80">{suggestion.reasoning}</p>
                {suggestion.warnings.length > 0 ? (
                  <ul className="space-y-1">
                    {suggestion.warnings.map((w, i) => (
                      <li key={i} className="text-[10px] text-amber-400/90 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-medium text-foreground/90">Detailed controls</span>
            <button
              type="button"
              onClick={() => {
                const next = !allOpen;
                setOpenGroups(next ? new Set(ALL_GROUPS) : new Set());
                rememberAll(next);
              }}
              className="text-xs text-primary underline underline-offset-2"
            >
              {allOpen ? "Close all" : "Show all controls"}
            </button>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Presets and AI Suggest set these for you. Open a section to fine-tune it.
          </p>

          <Group title="Bass" {...groupProps("bass")}>
            <ParamSlider
              label={band ? "Low-band level" : "Bass shelf"}
              value={params.bassGainDb}
              min={-12}
              max={12}
              step={0.5}
              format={fmtDb}
              onChange={(v) => patch({ bassGainDb: v })}
              disabled={noSong}
            />
            <ParamSlider
              label={band ? "Crossover" : "Shelf corner"}
              value={params.crossoverHz}
              min={60}
              max={200}
              step={1}
              format={(v) => `${v} Hz`}
              onChange={(v) => patch({ crossoverHz: v })}
              disabled={noSong}
              hint={
                band
                  ? "Everything below this is the 'bass stem'. Kick and low vocals land in it too."
                  : undefined
              }
            />
            <ParamSlider
              label="Punch bell"
              value={params.punchGainDb}
              min={-9}
              max={9}
              step={0.5}
              format={fmtDb}
              onChange={(v) => patch({ punchGainDb: v })}
              disabled={noSong}
            />
            <div className="grid grid-cols-2 gap-4">
              <ParamSlider
                label="Bell freq"
                value={params.punchFreq}
                min={35}
                max={160}
                step={1}
                format={(v) => `${v} Hz`}
                onChange={(v) => patch({ punchFreq: v })}
                disabled={noSong}
              />
              <ParamSlider
                label="Bell Q"
                value={params.punchQ}
                min={0.5}
                max={4}
                step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(v) => patch({ punchQ: v })}
                disabled={noSong}
              />
            </div>
          </Group>

          <Group title="Low-band treatment" dim={!band} {...groupProps("lowband")}>
            <ParamSlider
              label="Warmth (saturation)"
              value={params.warmth}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ warmth: v })}
              disabled={noSong || !band}
              hint="Adds harmonics so the bass still reads on phone and laptop speakers."
            />
            <ParamSlider
              label="Tighten (compression)"
              value={params.tighten}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ tighten: v })}
              disabled={noSong || !band}
            />
            <label
              className={cn(
                "flex items-center justify-between gap-3",
                (!band || noSong) && "opacity-40",
              )}
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Mono bass
              </span>
              <Switch
                checked={params.monoBass}
                onCheckedChange={(v) => patch({ monoBass: v })}
                disabled={noSong || !band}
              />
            </label>
          </Group>

          <Group title="Sub-40 rumble control" {...groupProps("sub")}>
            <ParamSlider
              label="Sub compressor"
              value={params.subCompAmount}
              min={0}
              max={1}
              step={0.01}
              format={(v) => (v === 0 ? "Off" : `${Math.round(v * 100)}%`)}
              onChange={(v) => patch({ subCompAmount: v })}
              disabled={noSong}
              hint="Dynamically ducks rumble below the crossover only when it gets loud — leaves punchy bass above it untouched. Best tool for Suno's vibrating sub-40 Hz bass."
            />
            <ParamSlider
              label="Sub comp crossover"
              value={params.subCompFreq}
              min={30}
              max={80}
              step={1}
              format={(v) => `${v} Hz`}
              onChange={(v) => patch({ subCompFreq: v })}
              disabled={noSong || params.subCompAmount === 0}
              hint="Everything below this goes through the sub compressor. 50 Hz is a good default — protects 50–100 Hz punch."
            />
            <ParamSlider
              label="Sub scoop"
              value={params.subScoopDb}
              min={-12}
              max={0}
              step={0.5}
              format={fmtDb}
              onChange={(v) => patch({ subScoopDb: v })}
              disabled={noSong}
              hint="Narrow EQ cut at the worst rumble frequency. Unlike the HPF, this only reduces a specific frequency instead of removing everything below it."
            />
            <div className="grid grid-cols-2 gap-4">
              <ParamSlider
                label="Scoop freq"
                value={params.subScoopFreq}
                min={20}
                max={50}
                step={1}
                format={(v) => `${v} Hz`}
                onChange={(v) => patch({ subScoopFreq: v })}
                disabled={noSong || params.subScoopDb === 0}
              />
              <ParamSlider
                label="Scoop Q"
                value={params.subScoopQ}
                min={1}
                max={6}
                step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(v) => patch({ subScoopQ: v })}
                disabled={noSong || params.subScoopDb === 0}
                hint="Higher = narrower cut. 3 is a good starting point."
              />
            </div>
            <div className={cn("flex items-center justify-between gap-3", noSong && "opacity-40")}>
              <div>
                <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  Solo sub
                </span>
                <p className="text-[10px] text-muted-foreground">Hear only what's below the sub comp crossover — check for rumble you can't otherwise hear.</p>
              </div>
              <button
                type="button"
                onClick={() => patch({ subSolo: !params.subSolo })}
                disabled={noSong}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  params.subSolo
                    ? "glow-primary border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Headphones className="size-3.5" />
                {params.subSolo ? "Soloing" : "Solo sub"}
              </button>
            </div>
          </Group>

          <Group title="Clean-up & finish" {...groupProps("finish")}>
            <ParamSlider
              label="Sub-rumble cut"
              value={params.subCutHz}
              min={0}
              max={40}
              step={1}
              format={(v) => (v === 0 ? "Off" : `${v} Hz`)}
              onChange={(v) => patch({ subCutHz: v > 0 && v < 18 ? 18 : v })}
              disabled={noSong}
              hint="Permanently removes inaudible sub-rumble (keep at or below 40 Hz). For boomy Suno bass, use Band mode + Tighten instead — it shapes without cutting."
            />
            {/* Slope toggle — only useful when HPF is on */}
            <div
              className={cn(
                "space-y-1.5",
                (noSong || params.subCutHz === 0) && "pointer-events-none opacity-40",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  HPF slope
                </span>
                <span className="font-mono text-xs text-accent">
                  {params.subCutSlope === 2 ? "−24 dB/oct" : "−12 dB/oct"}
                </span>
              </div>
              <div className="flex rounded-lg border border-border p-0.5">
                {(
                  [
                    [1, "Gentle", "−12 dB/oct"],
                    [2, "Steep", "−24 dB/oct (double)"],
                  ] as const
                ).map(([slope, label, tip]) => (
                  <button
                    key={slope}
                    type="button"
                    title={tip}
                    onClick={() => patch({ subCutSlope: slope })}
                    disabled={noSong || params.subCutHz === 0}
                    className={cn(
                      "flex-1 rounded-md py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                      params.subCutSlope === slope
                        ? "bg-primary/25 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Steep (24 dB/oct) removes more sub-rumble energy just above the cutoff.
              </p>
            </div>
            <ParamSlider
              label="HPF resonance (Q)"
              value={params.subCutQ}
              min={0.5}
              max={2.0}
              step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => patch({ subCutQ: v })}
              disabled={noSong || params.subCutHz === 0}
              hint="0.71 = flat (Butterworth). Above 1.0 adds a slight punch boost at the cutoff."
            />
            <ParamSlider
              label="Low-mid cut @ 250 Hz"
              value={params.lowMidCutDb}
              min={-6}
              max={0}
              step={0.5}
              format={fmtDb}
              onChange={(v) => patch({ lowMidCutDb: v })}
              disabled={noSong}
            />
            <ParamSlider
              label="Air shelf @ 10 kHz"
              value={params.airDb}
              min={0}
              max={6}
              step={0.5}
              format={fmtDb}
              onChange={(v) => patch({ airDb: v })}
              disabled={noSong}
            />
            <ParamSlider
              label="Glue compression"
              value={params.glue}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch({ glue: v })}
              disabled={noSong}
            />
            <ParamSlider
              label="Limiter ceiling"
              value={params.ceilingDb}
              min={-3}
              max={-0.1}
              step={0.1}
              format={(v) => `${v.toFixed(1)} dBFS`}
              onChange={(v) => patch({ ceilingDb: v })}
              disabled={noSong}
            />
          </Group>
        </div>
      </Panel>

      {/* ---------------- player / export ---------------- */}
      <Panel
        title="Preview & Export"
        subtitle={song ? song.name : "Drop a song or a single stem to start."}
        // On phones the upload/preview comes first, since loading a song is step one.
        className={cn("order-first lg:order-none", !song && "lg:self-start")}
      >
        <div className="space-y-4">
          {error ? <ErrorNote message={error} /> : null}

          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
            }}
          />

          {!song ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void loadFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              className={cn(
                "flex h-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center transition-colors",
                dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60",
              )}
            >
              {loading ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : (
                <Upload className="size-8 text-muted-foreground" />
              )}
              <p className="text-sm text-foreground/90">
                {loading ? "Decoding…" : "Drop an audio file here, or click to browse"}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Full song or a single stem (WAV, MP3, FLAC, M4A, OGG). Processing happens in this
                browser tab — the file is never uploaded and nothing is saved to your account.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                <FileAudio className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{song.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {fmtTime(song.buffer.duration)} ·{" "}
                    {song.buffer.numberOfChannels === 1 ? "mono" : "stereo"} ·{" "}
                    {(song.buffer.sampleRate / 1000).toFixed(1)} kHz ·{" "}
                    {(song.size / 1048576).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSong}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-background/60">
                <canvas
                  ref={canvasRef}
                  className="block h-56 w-full"
                  aria-label="Spectrum and EQ curve"
                />
                <div className="flex items-center justify-between border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 bg-violet" /> EQ curve (±15 dB)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-4 bg-brand/40" /> live spectrum
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => (playing ? pause() : void play())}
                  className="glow-primary size-10 rounded-full p-0"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <div className="min-w-[140px] flex-1">
                  <Slider
                    value={[position]}
                    min={0}
                    max={song.buffer.duration}
                    step={0.1}
                    onValueChange={(v) => {
                      setPosition(v[0]!);
                      offsetRef.current = v[0]!;
                    }}
                    onValueCommit={(v) => {
                      if (playing) void play(v[0]!);
                    }}
                    aria-label="Seek"
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmtTime(position)} / {fmtTime(song.buffer.duration)}
                </span>
                <div className="flex rounded-lg border border-border p-0.5">
                  {(
                    [
                      [true, "Original"],
                      [false, "Mastered"],
                    ] as const
                  ).map(([isOriginal, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setBypass(isOriginal)}
                      className={cn(
                        "rounded-md px-3 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors",
                        bypass === isOriginal
                          ? "bg-primary/25 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-foreground/90">
                  <Switch checked={matchOn} onCheckedChange={setMatchOn} />
                  Match loudness when comparing
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">{matchStatus}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                The match is estimated from a 30-second sample, so the A/B tells you about tone, not
                volume. It only affects this preview — the downloaded file is not level-matched to
                the original.
              </p>

              <div className="grid gap-4 rounded-lg border border-border bg-card/50 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    Loudness target
                  </span>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger className="border-border bg-card/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off — keep the level as processed</SelectItem>
                      <SelectItem value="-16">−16 LUFS (quiet, dynamic)</SelectItem>
                      <SelectItem value="-14">−14 LUFS (streaming standard)</SelectItem>
                      <SelectItem value="-11">−11 LUFS (loud)</SelectItem>
                      <SelectItem value="-9">−9 LUFS (very loud)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    WAV bit depth
                  </span>
                  <Select value={bits} onValueChange={(v) => setBits(v as "16" | "24")}>
                    <SelectTrigger className="border-border bg-card/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24-bit (keep for further mixing)</SelectItem>
                      <SelectItem value="16">16-bit (CD / final, dithered)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center justify-between gap-3 sm:col-span-2">
                  <span className="text-xs text-foreground/90">
                    Remove the song from this tab as soon as the download starts
                  </span>
                  <Switch checked={autoClear} onCheckedChange={setAutoClear} />
                </label>
              </div>

              <ReferenceMatch song={song.buffer} params={params} onApply={patch} />

              <Button
                onClick={() => void exportMaster()}
                disabled={!!exporting}
                className="glow-primary h-11 w-full gap-2 font-display tracking-wide"
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ?? "Render & Download WAV"}
              </Button>
            </>
          )}

          {result ? (
            <div className="rounded-lg border border-signal-high/40 bg-signal-high/10 p-4">
              <p className="flex items-center gap-2 text-sm text-foreground/90">
                <AudioWaveform className="size-4 text-signal-high" />
                Downloaded <span className="font-mono text-xs">{result.file}</span>
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div>
                  <span className="block text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    Loudness
                  </span>
                  {Number.isFinite(result.lufs) ? `${result.lufs.toFixed(1)} LUFS` : "—"}
                </div>
                <div>
                  <span className="block text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    True peak
                  </span>
                  {Number.isFinite(result.truePeakDb)
                    ? `${result.truePeakDb.toFixed(1)} dBFS`
                    : "—"}
                </div>
                <div>
                  <span className="block text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    Gain into limiter
                  </span>
                  {fmtDb(result.makeupDb)}
                </div>
              </div>
              {autoClear ? (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  The song has been cleared from this tab. Nothing was uploaded or stored.
                </p>
              ) : null}
            </div>
          ) : null}

          <BandLabFinish />

          <p className="hairline-top flex items-start gap-2 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal-high" />
            <span>
              Everything runs locally in your browser with the Web Audio API. Closing or reloading
              the tab also discards the file. Loudness is measured to ITU-R BS.1770 and the peak is
              checked as true peak (4× oversampled), so the ceiling holds between samples too. Leave
              it at −1 dBFS or lower for streaming.
            </span>
          </p>
        </div>
      </Panel>
    </div>
    </div>
  );
}

/** Optional last step: BandLab is free and is where many people finish AI songs. */
function BandLabFinish() {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <p className="text-sm font-semibold">Finishing in BandLab (optional)</p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          <span className="text-foreground/90">Rebalance stems:</span> BandLab's free online studio
          lets you raise a buried vocal or lower a loud instrument, which mastering can't do. Load
          your Suno stems, mix, then master the result here.
        </li>
        <li>
          <span className="text-foreground/90">Second opinion:</span> BandLab Mastering has 4 free
          presets (Universal, Fire, Clarity, Tape). Compare its result with yours.
        </li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a href="https://www.bandlab.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          BandLab
        </a>
        <a href="https://www.bandlab.com/mastering" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          BandLab Mastering
        </a>
      </div>
    </div>
  );
}
