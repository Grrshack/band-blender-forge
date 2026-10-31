import { Clapperboard, Download, FileAudio, ImagePlus, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorNote, Panel } from "./Field";
import { SongDrop } from "./SongMeasurements";
import { SpotifyCanvasPanel } from "./SpotifyCanvasPanel";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmLargeAudio } from "@/lib/audio/large-file";
import { encodeMp3 } from "@/lib/audio/mp3-encode";
import { analyzeSong, formatTime, type SongAnalysis } from "@/lib/audio/song-analysis";
import { decodeAudioFile } from "@/lib/audio/take-diagnosis";
import { getLastCover } from "@/lib/cover-render";
import { VIDEO_H, VIDEO_W, clipWav, drawFrame, renderLyricVideo, sliceWithFades, videoFormat } from "@/lib/lyric-video";
import { clipCandidates, linesInClip, parseLrc } from "@/lib/promo";
import { cn } from "@/lib/utils";

const save = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Couldn't load the image."));
    im.src = src;
  });

/** Best 15 or 30 seconds of the song, as an audio clip or a vertical lyric video. */
export function PromoClips({ state, onGoTab }: { state: ForgeState; onGoTab: (tab: string) => void }) {
  const [song, setSong] = useState<{ buffer: AudioBuffer; name: string; analysis: SongAnalysis } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [length, setLength] = useState<15 | 30>(15);
  const [pick, setPick] = useState(0);
  const [nudge, setNudge] = useState(0);
  const [cover, setCover] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState(state.lyrics.title || state.release?.cover?.title || "");
  const [artist, setArtist] = useState(state.release?.artist ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  // Use the cover made in Cover Maker this session, if there is one.
  useEffect(() => {
    const url = getLastCover();
    if (url) loadImage(url).then(setCover).catch(() => undefined);
  }, []);

  const load = async (file: File) => {
    if (!confirmLargeAudio(file)) return;
    setBusy("Measuring the song…");
    setError(null);
    try {
      const buffer = await decodeAudioFile(file);
      await new Promise((r) => setTimeout(r, 30));
      const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
      setSong({ buffer, name: file.name, analysis: analyzeSong(channels, buffer.sampleRate) });
      setPick(0);
      setNudge(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy("");
    }
  };

  const picks = useMemo(() => (song ? clipCandidates(song.analysis, length) : []), [song, length]);
  const chosen = picks[pick] ?? picks[0];
  const dur = song?.analysis.durationSec ?? 0;
  const start = chosen ? Math.max(0, Math.min(dur - length, chosen.start + nudge)) : 0;
  const end = Math.min(dur, start + length);
  const lrcLines = useMemo(() => parseLrc(state.release?.lrc ?? ""), [state.release?.lrc]);
  const clipLines = useMemo(() => linesInClip(lrcLines, start, end), [lrcLines, start, end]);
  const barSec = song?.analysis.bpm ? 240 / song.analysis.bpm : 2;

  // Preview the first lyric frame.
  useEffect(() => {
    const c = preview.current;
    if (!c || !song) return;
    c.width = VIDEO_W;
    c.height = VIDEO_H;
    drawFrame(c.getContext("2d")!, { start, end, cover, title, artist, lines: clipLines, accent: "#7c5cff" }, Math.min(2, clipLines[1]?.time ?? 0), 0);
  }, [song, start, end, cover, title, artist, clipLines]);

  const stop = () => {
    audioRef.current?.src.stop();
    void audioRef.current?.ctx.close();
    audioRef.current = null;
    setPlaying(false);
  };
  const playRange = (s: number, e: number) => {
    if (!song) return;
    stop();
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = song.buffer;
    src.connect(ctx.destination);
    // Only the clip that's still current may mark playback as finished.
    src.onended = () => {
      if (audioRef.current?.src !== src) return;
      audioRef.current = null;
      setPlaying(false);
      void ctx.close();
    };
    src.start(0, s, e - s);
    audioRef.current = { ctx, src };
    setPlaying(true);
  };
  const play = () => (playing ? stop() : playRange(start, end));
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Picking a moment plays it, and moving the clip while it plays restarts it at the new spot.
  const autoPlay = useRef(false);
  useEffect(() => {
    if (autoPlay.current || audioRef.current) {
      autoPlay.current = false;
      playRange(start, end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);
  const choose = (i: number) => {
    if (i === pick && nudge === 0) {
      playRange(start, end);
      return;
    }
    autoPlay.current = true;
    setPick(i);
    setNudge(0);
  };

  const base = `${(title || song?.name.replace(/\.[^.]+$/, "") || "clip").replace(/[^\w\- ]+/g, "").trim()}-${length}s`;
  const canvasBase = (title || song?.name.replace(/\.[^.]+$/, "") || "song").replace(/[^\w\- ]+/g, "").trim() || "song";

  const exportAudio = async (kind: "mp3" | "wav") => {
    if (!song) return;
    setBusy(kind === "mp3" ? "Encoding MP3…" : "Saving WAV…");
    try {
      if (kind === "wav") save(clipWav(song.buffer, start, end), `${base}.wav`);
      else {
        const bytes = await encodeMp3(sliceWithFades(song.buffer, start, end), song.buffer.sampleRate);
        save(new Blob([bytes], { type: "audio/mpeg" }), `${base}.mp3`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy("");
    }
  };

  const exportVideo = async () => {
    if (!song) return;
    stop();
    setError(null);
    setProgress(0);
    try {
      const out = await renderLyricVideo({
        buffer: song.buffer,
        start,
        end,
        cover,
        title,
        artist,
        lines: clipLines,
        accent: "#7c5cff",
        onProgress: setProgress,
      });
      save(out.blob, `${base}-vertical.${out.ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video couldn't be made.");
    } finally {
      setProgress(null);
    }
  };

  const canVideo = typeof window !== "undefined" && Boolean(videoFormat());

  return (
    <div className="space-y-5">
      <Panel
        title="Promo Clips"
        subtitle="Finds the best 15 or 30 seconds of your song and makes a vertical lyric clip for TikTok, Reels and Shorts. Runs in your browser."
      >
        {song ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
            <FileAudio className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {song.name} · {formatTime(dur)}
              {song.analysis.bpm ? ` · ${song.analysis.bpm} BPM` : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSong(null)} className="h-8 gap-1.5 text-xs">
              <Trash2 className="size-3.5" /> Change
            </Button>
          </div>
        ) : (
          <SongDrop onFile={(f) => void load(f)} busy={Boolean(busy)} />
        )}
        <p className="mt-2 text-xs text-muted-foreground">Use your mastered keeper, so the clip sounds like the release.</p>
        {error ? <div className="mt-3"><ErrorNote message={error} /></div> : null}
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadImage(URL.createObjectURL(f)).then(setCover); e.target.value = ""; }} />
      </Panel>

      {song && chosen ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <Panel title="1. Pick the moment" subtitle="Tap a moment to hear it. Clips start one bar before a big section, so the lift lands inside the clip.">
            <div className="mb-3 flex gap-1.5">
              {([15, 30] as const).map((n) => (
                <button key={n} type="button" onClick={() => { setLength(n); setPick(0); setNudge(0); }} className={cn("rounded-lg border px-3 py-1.5 text-sm", length === n ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}>
                  {n} seconds
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {picks.map((p, i) => (
                <li key={p.start}>
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    className={cn("w-full rounded-lg border p-3 text-left", i === pick ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40")}
                  >
                    <span className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{p.label}{i === 0 ? " (recommended)" : ""}</span>
                      <span className="font-mono text-muted-foreground">{formatTime(p.start)}–{formatTime(p.end)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{p.why}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Button size="sm" variant="outline" onClick={play} className="gap-1.5">
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Stop" : "Listen"}
              </Button>
              <span className="font-mono text-xs">{formatTime(start)}–{formatTime(end)}</span>
              <Button size="sm" variant="ghost" onClick={() => setNudge(nudge - barSec)} className="text-xs">← 1 bar earlier</Button>
              <Button size="sm" variant="ghost" onClick={() => setNudge(nudge + barSec)} className="text-xs">1 bar later →</Button>
            </div>

            <h3 className="mt-6 mb-2 text-sm font-semibold">2. Audio clip</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void exportAudio("mp3")} disabled={Boolean(busy)} className="gap-1.5">
                <Download className="size-3.5" /> MP3
              </Button>
              <Button size="sm" variant="outline" onClick={() => void exportAudio("wav")} disabled={Boolean(busy)} className="gap-1.5">
                <Download className="size-3.5" /> WAV
              </Button>
              {busy ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> {busy}</span> : null}
            </div>

            <h3 className="mt-6 mb-2 text-sm font-semibold">3. Lyric video (9:16)</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" aria-label="Artist" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={() => coverInput.current?.click()} className="gap-1.5 text-xs">
                <ImagePlus className="size-3.5" /> {cover ? "Change cover" : "Add cover"}
              </Button>
              {!cover ? (
                <button type="button" onClick={() => onGoTab("cover")} className="text-primary underline underline-offset-2">Make one in Cover Maker</button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {lrcLines.length
                ? `${clipLines.length} lyric line(s) in this clip, timed from your Lyric Check.`
                : "No lyric timing yet: the video shows the title only. Run Lyric Check on this song to add the words."}
            </p>
            {!lrcLines.length ? (
              <button type="button" onClick={() => onGoTab("lyriccheck")} className="mt-1 text-xs text-primary underline underline-offset-2">Open Lyric Check</button>
            ) : null}
            <div className="mt-3">
              <Button onClick={() => void exportVideo()} disabled={progress !== null || !canVideo} className="glow-primary gap-2">
                {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
                {progress !== null ? `Recording… ${Math.round(progress * 100)}%` : "Make the video"}
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {canVideo
                  ? "It plays the clip once while recording, so it takes as long as the clip. Keep this tab open."
                  : "This browser can't record video. Try Chrome, Edge or Safari on a computer."}
              </p>
            </div>
          </Panel>

          <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
            <canvas ref={preview} className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-xl border border-border" aria-label="Video preview" />
            <p className="text-center text-xs text-muted-foreground">Preview. The video moves with the music.</p>
          </div>
        </div>
      ) : null}

      <SpotifyCanvasPanel
        cover={cover}
        bpm={song?.analysis.bpm ?? null}
        baseName={canvasBase}
        onPickCover={() => coverInput.current?.click()}
        onMakeCover={() => onGoTab("cover")}
        onSave={save}
      />
    </div>
  );
}
