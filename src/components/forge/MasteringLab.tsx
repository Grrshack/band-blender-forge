import {
  AudioWaveform,
  Download,
  FileAudio,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { ReferenceMatch } from "./ReferenceMatch";
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
import {
  DEFAULT_PARAMS,
  MasterChain,
  PRESETS,
  renderMaster,
  sliceBuffer,
  type MasterParams,
} from "@/lib/audio/mastering-chain";
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

const MAX_FILE_MB = 250;
const FMIN = 20;
const FMAX = 20000;

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

function Group({
  title,
  children,
  dim,
}: {
  title: string;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card/50 p-3.5", dim && "opacity-60")}>
      <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
        {title}
      </h3>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

export function MasteringLab() {
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
    `Sub cut: ${params.subCutHz ? `${params.subCutHz} Hz` : "off"}`,
    `Low-mid cut @ 250 Hz: ${fmtDb(params.lowMidCutDb)}`,
    `Air shelf @ 10 kHz: ${fmtDb(params.airDb)}`,
    `Glue compression: ${Math.round(params.glue * 100)}%`,
    `Limiter ceiling: ${params.ceilingDb.toFixed(1)} dBFS`,
  ]
    .filter(Boolean)
    .join("\n");

  const band = params.mode === "band";
  const noSong = !song;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* ---------------- controls ---------------- */}
      <Panel
        title="Mastering Lab"
        subtitle="Bass-focused EQ for a finished mix or a bass stem."
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

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.hint}
                onClick={() =>
                  setParams((prev) => ({ ...DEFAULT_PARAMS, ...p.params, makeupDb: prev.makeupDb }))
                }
                className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase transition-colors hover:border-accent/60 hover:text-accent"
              >
                {p.name}
              </button>
            ))}
          </div>

          <Group title="Bass">
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

          <Group title="Low-band treatment" dim={!band}>
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

          <Group title="Clean-up & finish">
            <ParamSlider
              label="Sub cut (high-pass)"
              value={params.subCutHz}
              min={0}
              max={45}
              step={1}
              format={(v) => (v === 0 ? "Off" : `${v} Hz`)}
              onChange={(v) => patch({ subCutHz: v > 0 && v < 18 ? 18 : v })}
              disabled={noSong}
              hint="Removes rumble below what speakers can reproduce."
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
        subtitle={song ? song.name : "Drop a song or a bass stem to start."}
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
                Full mix or a bass stem (WAV, MP3, FLAC, M4A, OGG). Processing happens in this
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
  );
}
