import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { renderMaster, sliceBuffer, type MasterParams } from "@/lib/audio/mastering-chain";
import {
  BAND_CENTERS,
  adviseFromReference,
  bandSpectrumDb,
  type ReferenceAdvice,
} from "@/lib/audio/spectrum";
import { cn } from "@/lib/utils";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type State =
  | { status: "idle" }
  | { status: "working"; name: string }
  | { status: "done"; name: string; advice: ReferenceAdvice }
  | { status: "error"; message: string };

/**
 * Compares your song (as currently processed) with a reference track you like and suggests
 * bass-first moves on top of the current settings. Tone only — loudness drops out.
 */
export function ReferenceMatch({
  song,
  params,
  onApply,
}: {
  song: AudioBuffer;
  params: MasterParams;
  onApply: (patch: Partial<MasterParams>) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  const analyze = async (file: File) => {
    setState({ status: "working", name: file.name });
    try {
      const ref = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(
        await file.arrayBuffer(),
      );
      const refChannels = [
        ref.getChannelData(0),
        ref.getChannelData(ref.numberOfChannels > 1 ? 1 : 0),
      ];
      const refDb = bandSpectrumDb(refChannels, ref.sampleRate);
      await new Promise((r) => setTimeout(r, 30));

      const excerpt = sliceBuffer(song, 60);
      const processed = await renderMaster(excerpt, { ...params, makeupDb: 0 });
      const songDb = bandSpectrumDb(processed, excerpt.sampleRate);
      setState({ status: "done", name: file.name, advice: adviseFromReference(songDb, refDb) });
    } catch {
      setState({
        status: "error",
        message: "Couldn't read that reference file. WAV, MP3, FLAC or M4A usually work.",
      });
    }
  };

  const apply = (a: ReferenceAdvice) => {
    const d = a.delta;
    onApply({
      bassGainDb: clamp(params.bassGainDb + d.bassGainDb, -12, 12),
      lowMidCutDb: clamp(params.lowMidCutDb + d.lowMidCutDb, -6, 0),
      airDb: clamp(params.airDb + d.airDb, 0, 6),
      ...(d.subCutHz ? { subCutHz: d.subCutHz } : {}),
    });
  };

  const nothing = (a: ReferenceAdvice) =>
    a.delta.bassGainDb === 0 &&
    a.delta.lowMidCutDb === 0 &&
    a.delta.airDb === 0 &&
    !a.delta.subCutHz;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Reference track
        </span>
        <input
          ref={input}
          type="file"
          accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void analyze(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={state.status === "working"}
          onClick={() => input.current?.click()}
          className="h-8 gap-1.5 text-xs"
        >
          {state.status === "working" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {state.status === "working" ? "Analyzing…" : "Pick a song to match"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pick a finished song whose low end you like. You get suggested moves on top of your current
        settings. It matches tone, not loudness, and the reference never leaves this tab.
      </p>

      {state.status === "error" ? (
        <p className="mt-2 text-xs text-destructive">{state.message}</p>
      ) : null}

      {state.status === "done" ? (
        <div className="mt-3 space-y-3">
          <p className="font-mono text-[11px] text-muted-foreground">vs {state.name}</p>
          <div>
            <div
              className="flex h-24 items-stretch gap-[2px]"
              aria-label="Reference minus your song, per band"
            >
              {state.advice.diffDb.map((d, i) => {
                const h = Math.min(1, Math.abs(d) / 12) * 50;
                return (
                  <div
                    key={i}
                    className="relative flex-1"
                    title={`${BAND_CENTERS[i]} Hz: ${d > 0 ? "+" : ""}${d.toFixed(1)} dB`}
                  >
                    <div
                      className={cn(
                        "absolute right-0 left-0 rounded-sm",
                        d >= 0 ? "bg-accent" : "bg-destructive",
                      )}
                      style={
                        d >= 0
                          ? { bottom: "50%", height: `${h}%` }
                          : { top: "50%", height: `${h}%` }
                      }
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>25 Hz</span>
              <span>250</span>
              <span>1 kHz</span>
              <span>4k</span>
              <span>16 kHz</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Up = the reference has more there than your song; down = less.
            </p>
          </div>
          <ul className="space-y-1 text-xs text-foreground/90">
            {state.advice.lines.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            disabled={nothing(state.advice)}
            onClick={() => apply(state.advice)}
            className="h-8 text-xs"
          >
            {nothing(state.advice) ? "Nothing to change" : "Apply suggestions"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
