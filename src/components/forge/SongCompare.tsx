import { ArrowRight, CheckCircle2, FileAudio, Loader2, Scale, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorNote, Panel } from "./Field";
import { SaveToTake } from "./SaveToTake";
import { SongDrop } from "./SongMeasurements";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { confirmLargeAudio } from "@/lib/audio/large-file";
import { formatTime } from "@/lib/audio/song-analysis";
import { compareSongs, measureForCompare, type CompareMeasure, type CompareRow, type FixTool } from "@/lib/audio/song-compare";
import { decodeAudioFile } from "@/lib/audio/take-diagnosis";
import { attachCheck } from "@/lib/takes";
import { cn } from "@/lib/utils";

const tick = () => new Promise((r) => setTimeout(r, 30));

/** One song slot: decode and measure in the browser, keep only the numbers. */
function useCompareSlot() {
  const [measure, setMeasure] = useState<CompareMeasure | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (file: File) => {
    if (!confirmLargeAudio(file)) return;
    setBusy(true);
    setError(null);
    setMeasure(null);
    setName(file.name);
    try {
      const buffer = await decodeAudioFile(file);
      await tick(); // let the spinner paint before the heavy work
      const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
      setMeasure(measureForCompare(channels, buffer.sampleRate));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  };

  return { measure, name, busy, error, load, clear: () => setMeasure(null) };
}

const TOOL: Record<Exclude<FixTool, null>, { tab: string; label: string }> = {
  suno: { tab: "blend", label: "Band Blender" },
  fix: { tab: "fix", label: "Fix a Track" },
  master: { tab: "master", label: "Mastering" },
};

const ENERGY: Record<string, string> = {
  low: "bg-muted-foreground/30",
  mid: "bg-primary/50",
  high: "bg-primary",
};

function Slot({
  title,
  hint,
  slot,
}: {
  title: string;
  hint: string;
  slot: ReturnType<typeof useCompareSlot>;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {slot.measure ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
          <FileAudio className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{slot.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(slot.measure.analysis.durationSec)}
              {slot.measure.analysis.bpm ? ` · ${slot.measure.analysis.bpm} BPM` : ""}
              {slot.measure.analysis.key ? ` · ${slot.measure.analysis.key.label}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={slot.clear} className="h-8 gap-1.5 text-xs text-muted-foreground">
            <Trash2 className="size-3.5" /> Change
          </Button>
        </div>
      ) : (
        <SongDrop onFile={(f) => void slot.load(f)} busy={slot.busy} />
      )}
      {slot.error ? <ErrorNote message={slot.error} /> : null}
    </div>
  );
}

/** Both songs' sections on one time scale, with the first big lift marked. */
function Timelines({ yours, theirs }: { yours: CompareMeasure; theirs: CompareMeasure }) {
  const span = Math.max(yours.analysis.durationSec, theirs.analysis.durationSec) || 1;
  const row = (label: string, m: CompareMeasure) => (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative h-8">
        <div
          className="flex h-full overflow-hidden rounded-md"
          style={{ width: `${(m.analysis.durationSec / span) * 100}%` }}
          role="img"
          aria-label={`${label}: ${m.analysis.sections.map((s) => `${formatTime(s.start)} ${s.energy}`).join(", ")}`}
        >
          {m.analysis.sections.map((s, i) => (
            <div
              key={i}
              className={cn("h-full border-r border-background last:border-r-0", ENERGY[s.energy])}
              style={{ width: `${((s.end - s.start) / m.analysis.durationSec) * 100}%` }}
              title={`${formatTime(s.start)}–${formatTime(s.end)} ${s.energy} energy`}
            />
          ))}
        </div>
        {m.firstLiftSec !== null ? (
          <span
            className="absolute -top-1 bottom-[-4px] w-0.5 bg-foreground"
            style={{ left: `${(m.firstLiftSec / span) * 100}%` }}
            title={`First big lift at ${formatTime(m.firstLiftSec)}`}
          />
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      {row("Yours", yours)}
      {row("Reference", theirs)}
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
        <span />
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>0:00</span>
          <span>{formatTime(span / 2)}</span>
          <span>{formatTime(span)}</span>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-primary" /> high energy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-primary/50" /> mid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/30" /> low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-foreground" /> first big lift
        </span>
      </p>
    </div>
  );
}

const STATUS: Record<CompareRow["status"], { label: string; cls: string }> = {
  close: { label: "Close", cls: "border-signal-high/40 text-signal-high" },
  differs: { label: "Different", cls: "border-amber-500/40 text-amber-300" },
  info: { label: "Info", cls: "border-border text-muted-foreground" },
};

export function SongCompare({
  onGoTab,
  state,
  patch,
}: {
  onGoTab: (tab: string) => void;
  state?: ForgeState;
  patch?: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
}) {
  const yours = useCompareSlot();
  const theirs = useCompareSlot();
  const result = useMemo(
    () => (yours.measure && theirs.measure ? compareSongs(yours.measure, theirs.measure) : null),
    [yours.measure, theirs.measure],
  );
  const toChange = result?.rows.filter((r) => r.status === "differs") ?? [];

  return (
    <div className="space-y-5">
      <Panel
        title="Compare two songs (v1)"
        subtitle="Your song next to one you love: what's different, and what to change. Both stay on this device."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Slot title="1. Your song" hint="A Suno take or your master." slot={yours} />
          <Slot title="2. A song you love" hint="The sound or structure you're aiming for." slot={theirs} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Use a song you own or have permission to use. Both files are measured in your browser; nothing is uploaded or
          saved, and no AI key is needed.
        </p>
      </Panel>

      {result && yours.measure && theirs.measure ? (
        <>
          <Panel title="How they differ" subtitle="Measured, not judged. Neither song is scored as better.">
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary/40">
                <span className="text-2xl font-bold">{result.matchPct}%</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Match to the reference</p>
                <p className="text-xs text-muted-foreground">
                  How closely your song&apos;s structure, tempo, loudness and tone track the one you love. It isn&apos;t a
                  quality score: a different song can be just as good.
                </p>
              </div>
            </div>

            <Timelines yours={yours.measure} theirs={theirs.measure} />

            <h3 className="mt-6 mb-2 text-sm font-semibold">
              {toChange.length ? `What to change (${toChange.length})` : "What to change"}
            </h3>
            {toChange.length ? (
              <ul className="space-y-2">
                {toChange.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-card/40 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        yours {r.yours} · theirs {r.theirs}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">{r.tip}</p>
                    {r.tool ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGoTab(TOOL[r.tool!].tab)}
                        className="mt-2 h-8 gap-1.5 text-xs"
                      >
                        Open {TOOL[r.tool].label} <ArrowRight className="size-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-signal-high/40 bg-signal-high/10 p-3 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-signal-high" /> Nothing stands out: your song is close to
                the reference on everything measured.
              </p>
            )}

            <details className="group mt-5 rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <Scale className="size-4 text-primary" />
                <span className="flex-1">All measurements side by side</span>
                <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
              </summary>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-normal">Measure</th>
                      <th className="py-1.5 pr-3 font-normal">Yours</th>
                      <th className="py-1.5 pr-3 font-normal">Reference</th>
                      <th className="py-1.5 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-2 pr-3">{r.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.yours}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.theirs}</td>
                        <td className="py-2 text-right">
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS[r.status].cls)}>
                            {STATUS[r.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="mt-4 text-xs text-muted-foreground">
              Sections come from changes in loudness, so the &quot;first big lift&quot; is where the energy jumps, which is
              usually the chorus or drop but not always the hook itself.
            </p>

            {state && patch ? (
              <div className="mt-4">
                <SaveToTake
                  what="Compare Songs"
                  takes={state.takes}
                  style={state.blend.result?.styleTag ?? ""}
                  exclude={state.blend.result?.excludeStyles ?? ""}
                  onSave={(takes, id) =>
                    patch(
                      "takes",
                      attachCheck(takes, id, "compare", {
                        at: new Date().toISOString(),
                        matchPct: result.matchPct,
                        reference: theirs.name,
                        differs: result.rows.filter((r) => r.status === "differs").map((r) => r.label),
                      }),
                    )
                  }
                />
              </div>
            ) : null}
          </Panel>
        </>
      ) : yours.busy || theirs.busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Measuring…
        </p>
      ) : null}
    </div>
  );
}
