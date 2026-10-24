import { FileAudio, Loader2 } from "lucide-react";
import { confirmLargeAudio } from "@/lib/audio/large-file";
import { useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { analyzeSong, formatTime, sunoTags, type SongAnalysis } from "@/lib/audio/song-analysis";
import { decodeAudioFile } from "@/lib/audio/take-diagnosis";
import { cn } from "@/lib/utils";

const tick = () => new Promise((r) => setTimeout(r, 30));

/** Picks a file, decodes it and measures it, all in the browser. */
export function useSongAnalysis() {
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (file: File) => {
    if (!confirmLargeAudio(file)) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setFileName(file.name);
    try {
      const buffer = await decodeAudioFile(file);
      await tick(); // let the spinner paint before the heavy work
      const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
      setAnalysis(analyzeSong(channels, buffer.sampleRate));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyze that file.");
    } finally {
      setBusy(false);
    }
  };

  return { analysis, fileName, busy, error, analyze, reset: () => setAnalysis(null) };
}

export function SongDrop({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      disabled={busy}
      className={cn(
        "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
        over ? "border-primary bg-primary/10" : "border-border hover:border-primary/60",
      )}
    >
      {busy ? <Loader2 className="size-6 animate-spin text-primary" /> : <FileAudio className="size-6 text-primary" />}
      <span className="font-medium">{busy ? "Listening…" : "Drop a song here or click to choose"}</span>
      <span className="text-xs text-muted-foreground">
        MP3, WAV, M4A or FLAC. Measured in your browser; the file is never uploaded.
      </span>
      <input
        ref={ref}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

const ENERGY_STYLE: Record<string, string> = {
  low: "bg-muted-foreground/30",
  mid: "bg-primary/50",
  high: "bg-primary",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Tempo, key, length, tone and the section timeline. */
export function SongMeasurements({ analysis, fileName }: { analysis: SongAnalysis; fileName: string }) {
  const a = analysis;
  const tags = sunoTags(a);
  const total = a.durationSec || 1;
  return (
    <div className="space-y-4">
      <p className="truncate text-xs text-muted-foreground">{fileName}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Tempo"
          value={a.bpm ? `${a.bpm} BPM` : "Unclear"}
          note={a.bpm ? `Could feel like ${Math.round(a.bpm / 2)} or ${a.bpm * 2}` : "No steady beat found"}
        />
        <Stat
          label="Key"
          value={a.key ? a.key.label : "Unclear"}
          note={a.key ? `${a.key.confidence} confidence · or ${a.key.alternative}` : undefined}
        />
        <Stat label="Length" value={formatTime(a.durationSec)} note={a.sections.length ? `${a.sections.length} sections` : undefined} />
        <Stat
          label="Loudness"
          value={a.loudnessLufs !== null ? `${a.loudnessLufs} LUFS` : "—"}
          note={`${a.tone.loudness} master`}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1">{a.tone.bass} bass</span>
        <span className="rounded-full border border-border px-2.5 py-1">{a.tone.brightness} top end</span>
        <span className="rounded-full border border-border px-2.5 py-1">{a.tone.loudness} master</span>
      </div>

      {a.sections.length ? (
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Sections (by energy)
          </p>
          <div className="flex h-8 w-full overflow-hidden rounded-md" role="img" aria-label="Section timeline">
            {a.sections.map((s, i) => (
              <div
                key={i}
                className={cn("h-full border-r border-background last:border-r-0", ENERGY_STYLE[s.energy])}
                style={{ width: `${((s.end - s.start) / total) * 100}%` }}
                title={`${formatTime(s.start)}–${formatTime(s.end)} ${s.energy} energy`}
              />
            ))}
          </div>
          <ol className="mt-3 divide-y divide-border rounded-lg border border-border">
            {a.sections.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="w-24 font-mono text-xs text-muted-foreground">
                  {formatTime(s.start)}–{formatTime(s.end)}
                </span>
                <span className={cn("size-2.5 rounded-full", ENERGY_STYLE[s.energy])} aria-hidden="true" />
                <span className="w-16 text-xs text-muted-foreground">{s.energy}</span>
                <span className="flex-1">{s.guess}?</span>
                {s.bars ? <span className="font-mono text-xs text-muted-foreground">{s.bars} bars</span> : null}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Sections are found from changes in loudness, so the names are guesses. Bars assume 4 beats per bar.
          </p>
        </div>
      ) : null}

      {tags ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <span className="text-xs text-muted-foreground">For your Suno style prompt:</span>
          <code className="font-mono text-sm text-primary">{tags}</code>
          <CopyButton value={tags} size="icon" />
        </div>
      ) : null}
    </div>
  );
}
