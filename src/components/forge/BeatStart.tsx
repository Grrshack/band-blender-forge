import { Drum, ExternalLink, FileAudio, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { Button } from "@/components/ui/button";
import { estimateBpm } from "@/lib/audio/tempo";
import { decodeAudioFile, mixToMono } from "@/lib/audio/take-diagnosis";
import { cn } from "@/lib/utils";

/** Free, no-account beat makers that export WAV and MIDI (checked Oct 2026). */
const BEAT_MAKERS = [
  {
    name: "BAP Studio",
    url: "https://bap.studio/",
    note: "Drum machine with 808/909 kits. No sign-up. Exports WAV and MIDI.",
  },
  {
    name: "Beat Machine (eMusic Tools)",
    url: "https://emusic.tools/en/tools/beat-machine",
    note: "Step sequencer. No sign-in, no watermark. Exports WAV and MIDI.",
  },
  {
    name: "BandLab",
    url: "https://www.bandlab.com/",
    note: "Free online studio with drum machine and loops. Account needed. Exports WAV.",
  },
];

const FEELS = [
  "four-on-the-floor kick",
  "boom-bap drums",
  "trap hi-hat rolls",
  "half-time groove",
  "swung shuffle",
  "breakbeat",
  "808 bass",
  "live acoustic drums",
  "dusty lo-fi drums",
];

/**
 * Start from a beat: make one with a free tool, then either upload it to Suno (paid plans)
 * or describe it in the style prompt. Tempo is estimated in the browser; nothing is uploaded.
 */
export function BeatStart({ onAddToStyle }: { onAddToStyle?: ((line: string) => void) | undefined }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [useHalf, setUseHalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feels, setFeels] = useState<string[]>([]);

  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buffer = await decodeAudioFile(file);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
      const est = estimateBpm(mixToMono(channels), buffer.sampleRate);
      if (!est) setError("Couldn't find a steady beat. Try a loop of at least 4 seconds with drums.");
      setBpm(est);
      setUseHalf(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  };

  const shown = bpm ? (useHalf ? Math.round(bpm / 2) : bpm) : null;
  const line = [shown ? `${shown} bpm` : "", ...feels].filter(Boolean).join(", ");

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold">1. Make a beat with a free tool</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {BEAT_MAKERS.map((b) => (
            <li key={b.name} className="rounded-lg border border-border bg-card/50 p-3">
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
              >
                {b.name} <ExternalLink className="size-3" />
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{b.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          These sites don't spell out the rights to exported beats. Build from their basic drum
          sounds rather than someone else's samples if you plan to release the song.
        </p>
        <div className="mt-3 rounded-lg border border-border bg-card/50 p-3">
          <p className="text-sm font-medium">Or sketch a whole song in Gemini</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Google&apos;s{" "}
            <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              Gemini app
            </a>{" "}
            (Lyria 3.5 model) makes a free ~2-minute song with vocals from a description. Get a ready prompt from the
            Export Sheet&apos;s &quot;Gemini / Flow&quot; tab. If you like it, download it and upload it to Suno below. Gemini
            is good for quick ideas; Suno gives you editing, covers and longer songs to finish it.{" "}
            <a href="/guides/sketch-in-gemini-finish-in-suno" className="text-primary underline underline-offset-2">
              How it works
            </a>
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">2. Get it into Suno</p>
        <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-foreground/90">
          <li>
            <span className="font-medium">Upload it:</span> on Suno&apos;s Create page, use{" "}
            <a
              href="https://help.suno.com/en/articles/6141569"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Upload Audio
            </a>{" "}
            (up to 60 seconds on the free plan, up to 8 minutes on Pro and Premier), then use Extend to
            continue it or Cover to remake it in a new style. Only upload audio you made or own; Suno
            blocks copyrighted works.
          </li>
          <li>
            <span className="font-medium">Free plan, or to steer any generation:</span> describe the
            beat in your style prompt. Drop the beat file below to estimate its tempo, pick its feel,
            and copy the line.
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-3 text-sm hover:border-primary/50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileAudio className="size-4 text-primary" />}
          {busy ? "Finding the tempo…" : "Choose your beat file (WAV or MP3). It stays in your browser."}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {bpm ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Drum className="size-4 text-primary" />
            Estimated tempo:
            {[bpm, Math.round(bpm / 2)].map((b, i) => (
              <button
                key={b}
                type="button"
                aria-pressed={useHalf === (i === 1)}
                onClick={() => setUseHalf(i === 1)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  useHalf === (i === 1)
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {b} BPM{i === 1 ? " (half-time)" : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Beat feel">
          {FEELS.map((f) => {
            const on = feels.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFeels(on ? feels.filter((x) => x !== f) : [...feels, f])}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>

        {line ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2.5">
            <code className="min-w-0 flex-1 text-xs text-accent">{line}</code>
            <CopyButton value={line} size="icon" />
            {onAddToStyle ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddToStyle(line)}>
                Add to my style prompt
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
