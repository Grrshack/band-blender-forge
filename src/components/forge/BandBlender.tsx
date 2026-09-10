import { useServerFn } from "@tanstack/react-start";
import { Loader2, Radar, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CopyButton } from "./CopyButton";
import { Panel, ReadoutField } from "./Field";
import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

export type BlendResult = {
  confidence?: { level?: string; note?: string };
  genre?: string;
  tempo?: string;
  instrumentation?: string;
  vocals?: string;
  mood?: string;
  styleTag?: string;
  reconciliation?: string;
  recommendedSliders?: { energy?: number; complexity?: number; brightness?: number };
  sliderNotes?: string;
};

const SLIDERS = [
  { key: "energy", label: "Energy" },
  { key: "complexity", label: "Complexity" },
  { key: "brightness", label: "Brightness" },
] as const;

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
  onSendToForge,
}: {
  onSendToForge: (blend: BlendResult) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [artists, setArtists] = useState(["", "", ""]);
  const [sliders, setSliders] = useState({ energy: 60, complexity: 50, brightness: 55 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BlendResult | null>(null);

  const setArtist = (i: number, v: string) =>
    setArtists((prev) => prev.map((a, idx) => (idx === i ? v : a)));

  const run = async () => {
    const names = artists.map((a) => a.trim()).filter(Boolean);
    if (names.length === 0) {
      toast.error("Add at least one artist to blend.");
      return;
    }
    setLoading(true);
    try {
      const res = await forge({
        data: { task: "blend", routing, apiKey, payload: { artists: names, sliders } },
      });
      const blend = JSON.parse(res.json) as BlendResult;
      setResult(blend);
      if (blend.recommendedSliders) {
        setSliders({
          energy: blend.recommendedSliders.energy ?? sliders.energy,
          complexity: blend.recommendedSliders.complexity ?? sliders.complexity,
          brightness: blend.recommendedSliders.brightness ?? sliders.brightness,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Blend failed.");
    } finally {
      setLoading(false);
    }
  };

  const level = (result?.confidence?.level ?? "medium").toLowerCase();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel title="Band Lookup" subtitle="Blend up to three artists into one produceable style.">
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
                    setSliders((prev) => ({ ...prev, [s.key]: v[0] ?? prev[s.key] }))
                  }
                />
              </div>
            ))}
            {result?.sliderNotes ? (
              <p className="text-xs text-muted-foreground italic">{result.sliderNotes}</p>
            ) : null}
          </div>

          <Button
            onClick={run}
            disabled={loading}
            className="mt-5 h-11 w-full gap-2 font-display tracking-wide glow-violet"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading ? "Blending…" : "Run Blend"}
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
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center">
              <Radar className="size-8 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Enter one to three artists and run the blend to get genre, tempo, instrumentation,
                vocals, mood and a copy-ready style tag prompt.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
