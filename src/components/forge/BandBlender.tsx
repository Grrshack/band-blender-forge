import { useServerFn } from "@tanstack/react-start";
import { Loader2, Radar, Sparkles, Wand } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel, ReadoutField } from "./Field";
import { useSettings } from "./settings";
import type { BlendResult, BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

export type { BlendResult } from "./types";

const SLIDERS = [
  { key: "energy", label: "Energy" },
  { key: "complexity", label: "Complexity" },
  { key: "brightness", label: "Brightness" },
] as const;

const DEMO = ["Portishead", "Massive Attack", "FKA twigs"];

function ConfidenceLamp({ level, note }: { level: string; note: string }) {
  const tone =
    level === "high"
      ? "text-signal-high border-signal-high/50 bg-signal-high/10"
      : level === "medium"
        ? "text-signal-mid border-signal-mid/50 bg-signal-mid/10"
        : "text-signal-low border-signal-low/50 bg-signal-low/10";
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", tone)}>
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-current" />
      </span>
      <div className="text-xs">
        <span className="font-mono tracking-[0.18em] uppercase">Confidence: {level}</span>
        <span className="ml-2 text-muted-foreground">{note}</span>
      </div>
    </div>
  );
}

export function BandBlender({
  value,
  onChange,
  onSendToForge,
}: {
  value: BlendSlice;
  onChange: (next: BlendSlice) => void;
  onSendToForge: (blend: BlendResult) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { artists, sliders, result } = value;

  const setArtist = (i: number, v: string) =>
    onChange({ ...value, artists: artists.map((a, idx) => (idx === i ? v : a)) });

  const run = async (override?: string[]) => {
    const source = override ?? artists;
    const names = source.map((a) => a.trim()).filter(Boolean);
    if (names.length === 0) {
      setError("Add at least one artist to blend.");
      return;
    }
    setError(null);
    setLoading(true);
    setStage("Assessing artist familiarity…");
    const timer = setTimeout(() => setStage("Reconciling conflicting elements…"), 3500);
    try {
      const res = await forge({
        data: { task: "blend", routing, apiKey, payload: { artists: names, sliders } },
      });
      const blend = JSON.parse(res.json) as BlendResult;
      onChange({
        artists: override ?? artists,
        sliders: {
          energy: blend.recommendedSliders?.energy ?? sliders.energy,
          complexity: blend.recommendedSliders?.complexity ?? sliders.complexity,
          brightness: blend.recommendedSliders?.brightness ?? sliders.brightness,
        },
        result: blend,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Blend failed.");
    } finally {
      clearTimeout(timer);
      setStage("");
      setLoading(false);
    }
  };

  const level = (result?.confidence?.level ?? "medium").toLowerCase();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel title="Band Lookup" subtitle="Blend up to three artists into one produceable style.">
          {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
          <div className="space-y-3">
            {artists.map((a, i) => (
              <div key={i} className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
                  0{i + 1}
                </span>
                <Input
                  value={a}
                  onChange={(e) => setArtist(i, e.target.value)}
                  placeholder={
                    ["Primary artist", "Second artist (optional)", "Third artist (optional)"][i]
                  }
                  className="h-11 border-border bg-card/60 pl-10 focus-visible:ring-primary"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  <span>{s.label}</span>
                  <span className="text-accent">{sliders[s.key]}</span>
                </div>
                <Slider
                  value={[sliders[s.key]]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) =>
                    onChange({
                      ...value,
                      sliders: { ...sliders, [s.key]: v[0] ?? sliders[s.key] },
                    })
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground italic">
              {result?.sliderNotes ??
                "Move these before re-running — the blend is rebuilt around your targets."}
            </p>
          </div>

          <Button
            onClick={() => void run()}
            disabled={loading}
            className="glow-primary mt-5 h-11 w-full gap-2 font-display tracking-wide"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading ? stage || "Blending…" : result ? "Re-run With These Sliders" : "Run Blend"}
          </Button>
        </Panel>
      </div>

      <div className="space-y-5">
        {result ? (
          <>
            <Panel
              title="Style Breakdown"
              subtitle="Coherent, production-ready parameters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSendToForge(result)}
                  className="gap-1.5 border-primary/50 bg-primary/10 text-xs hover:bg-primary/20"
                >
                  <Sparkles className="size-3.5" /> Send to Lyric Forge
                </Button>
              }
            >
              <ConfidenceLamp level={level} note={result.confidence?.note ?? ""} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ReadoutField label="Genre" value={result.genre ?? "—"} />
                <ReadoutField label="Tempo" value={result.tempo ?? "—"} />
                <ReadoutField label="Instrumentation" value={result.instrumentation ?? "—"} />
                <ReadoutField label="Vocals" value={result.vocals ?? "—"} />
                <ReadoutField label="Mood" value={result.mood ?? "—"} />
              </div>
              <div className="mt-3">
                <ReadoutField
                  label="Suno Style Tag Prompt"
                  value={result.styleTag ?? "—"}
                  mono
                  accent
                />
              </div>
            </Panel>

            <Panel
              title="Blend Reconciliation Logic"
              subtitle="How the conflicting styles are fused."
              action={<CopyButton value={result.reconciliation ?? ""} />}
            >
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90">
                {result.reconciliation ?? "—"}
              </p>
            </Panel>
          </>
        ) : (
          <Panel title="Style Breakdown" subtitle="Awaiting input.">
            <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border px-6 text-center">
              <Radar className="size-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                Name one to three artists — the more specific the better. Try a contrast the model
                has to reconcile, like{" "}
                <span className="text-foreground">Johnny Cash + Burial</span>, rather than three
                artists from the same shelf.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange({ ...value, artists: DEMO });
                  void run(DEMO);
                }}
                className="gap-1.5 border-accent/50 bg-accent/10 text-xs text-accent hover:bg-accent/20"
              >
                <Wand className="size-3.5" /> Try a demo blend
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
