import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { renderMaster, sliceBuffer, type MasterParams } from "@/lib/audio/mastering-chain";
import { measureLoudness } from "@/lib/audio/mastering-dsp";
import {
  BAND_CENTERS,
  adviseFromReference,
  bandSpectrumDb,
  scaleAdvice,
  targetFromReference,
  type ReferenceAdvice,
} from "@/lib/audio/spectrum";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type State =
  | { status: "idle" }
  | { status: "working"; name: string }
  | { status: "done"; name: string; advice: ReferenceAdvice; targetLufs: number | null }
  | { status: "error"; message: string };

/**
 * Compares your song (as currently processed) with a reference track you like and suggests
 * moves across the range (bass, mud, body, presence, air or hiss) on top of the current
 * settings, scaled by a match amount. Loudness is offered separately as an export target.
 */
export function ReferenceMatch({
  song,
  params,
  onApply,
  onTarget,
}: {
  song: AudioBuffer;
  params: MasterParams;
  onApply: (patch: Partial<MasterParams>) => void;
  /** Sets the export loudness target, e.g. "-10". */
  onTarget?: (lufs: string) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [amount, setAmount] = useState(0.75);

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
      const targetLufs = targetFromReference(measureLoudness(refChannels, ref.sampleRate).lufs);
      await new Promise((r) => setTimeout(r, 30));

      const excerpt = sliceBuffer(song, 60);
      const processed = await renderMaster(excerpt, { ...params, makeupDb: 0 });
      const songDb = bandSpectrumDb(processed, excerpt.sampleRate);
      setState({ status: "done", name: file.name, advice: adviseFromReference(songDb, refDb), targetLufs });
    } catch {
      setState({
        status: "error",
        message: "Couldn't read that reference file. WAV, MP3, FLAC or M4A usually work.",
      });
    }
  };

  const apply = (a: ReferenceAdvice) => {
    const d = scaleAdvice(a.delta, amount);
    onApply({
      bassGainDb: clamp(params.bassGainDb + d.bassGainDb, -12, 12),
      lowMidCutDb: clamp(params.lowMidCutDb + d.lowMidCutDb, -6, 0),
      airDb: clamp(params.airDb + d.airDb, 0, 6),
      midDb: clamp((params.midDb ?? 0) + d.midDb, -4, 4),
      presenceDb: clamp((params.presenceDb ?? 0) + d.presenceDb, -4, 4),
      deHiss: clamp(Math.max(params.deHiss ?? 0, d.deHiss), 0, 1),
      ...(d.subCutHz ? { subCutHz: d.subCutHz } : {}),
    });
  };

  const nothing = (a: ReferenceAdvice) => {
    const d = scaleAdvice(a.delta, amount);
    return (
      d.bassGainDb === 0 &&
      d.lowMidCutDb === 0 &&
      d.airDb === 0 &&
      d.midDb === 0 &&
      d.presenceDb === 0 &&
      d.deHiss === 0 &&
      !d.subCutHz
    );
  };

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
        Pick a finished song whose sound you like. You get suggested moves on top of your current
        settings, from the low end to the top, plus its loudness as an export target. The reference
        never leaves this tab.
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/90">Match amount</span>
              <span className="font-mono text-muted-foreground">{Math.round(amount * 100)}%</span>
            </div>
            <Slider
              value={[amount]}
              min={0.25}
              max={1}
              step={0.05}
              onValueChange={(v) => setAmount(v[0] ?? 0.75)}
              aria-label="Match amount"
            />
            <p className="text-[10px] text-muted-foreground">
              100% moves all the way toward the reference. 50–75% keeps more of your song&apos;s own character.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={nothing(state.advice)}
              onClick={() => apply(state.advice)}
              className="h-8 text-xs"
            >
              {nothing(state.advice) ? "Nothing to change" : "Apply tone suggestions"}
            </Button>
            {onTarget && state.targetLufs !== null ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onTarget(String(state.targetLufs))}
                className="h-8 text-xs"
              >
                Match its loudness ({state.targetLufs} LUFS)
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
