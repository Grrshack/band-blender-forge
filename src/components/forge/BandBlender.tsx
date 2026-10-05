import { useServerFn } from "@tanstack/react-start";
import { Info, Loader2, Radar, Send, ShieldAlert, Sparkles, Wand } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel, ReadoutField } from "./Field";
import { MbBadge } from "./MbBadge";
import { useSettings } from "./settings";
import type { BlendResult, BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { runForge } from "@/lib/forge.functions";
import { vocalString } from "@/lib/suno";
import { cn } from "@/lib/utils";

export type { BlendResult } from "./types";

const SLIDERS = [
  {
    key: "energy",
    label: "Energy",
    hint: "How intense and driving the track feels — low is sparse and restrained, high is aggressive and relentless.",
  },
  {
    key: "complexity",
    label: "Complexity",
    hint: "How intricate the arrangement is — low is simple and repetitive, high is layered and technical.",
  },
  {
    key: "brightness",
    label: "Brightness",
    hint: "The overall tonal character — low is dark and bass-heavy, high is crisp and shimmering.",
  },
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
  onOpenSunoSheet,
}: {
  value: BlendSlice;
  onChange: (next: BlendSlice) => void;
  onSendToForge: (blend: BlendResult) => void;
  onOpenSunoSheet: () => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { artists, sliders, result, lookupMode = "band", songTitle = "" } = value;

  const setArtist = (i: number, v: string) =>
    onChange({ ...value, artists: artists.map((a, idx) => (idx === i ? v : a)) });

  const run = async (override?: string[]) => {
    const isSong = lookupMode === "song";
    const source = override ?? artists;
    const names = source.map((a) => a.trim()).filter(Boolean);
    if (!isSong && names.length === 0) {
      setError("Add at least one artist to blend.");
      return;
    }
    if (isSong && !songTitle.trim()) {
      setError("Enter a song title.");
      return;
    }
    setError(null);
    setLoading(true);
    setStage(
      isSong ? "Looking up recording in MusicBrainz…" : "Checking artists against MusicBrainz…",
    );
    const t1 = setTimeout(
      () => setStage(isSong ? "Analysing production style…" : "Assessing artist familiarity…"),
      3500,
    );
    const t2 = setTimeout(
      () => setStage(isSong ? "Building Suno prompt…" : "Reconciling conflicting elements…"),
      7000,
    );
    try {
      const payload = isSong
        ? { title: songTitle.trim(), artist: names[0] ?? "" }
        : { artists: names, sliders };
      const res = await forge({
        data: { task: isSong ? "song" : "blend", routing, apiKey, payload },
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
        lookupMode,
        songTitle,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Blend failed.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setStage("");
      setLoading(false);
    }
  };

  const level = (result?.confidence?.level ?? "medium").toLowerCase();

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel
          className="blend-controls"
          title="Band Lookup"
          subtitle={
            lookupMode === "song"
              ? "Analyse one specific song's production style."
              : "Blend up to three artists into one produceable style."
          }
        >
          {/* Mode toggle */}
          <div className="mb-4 flex rounded-lg border border-border p-0.5">
            {(["band", "song"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="ghost"
                onClick={() => onChange({ ...value, lookupMode: m, result: null })}
                className={cn(
                  "flex-1 rounded-md py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  lookupMode === m
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "band" ? "Band / Artist blend" : "Single song"}
              </Button>
            ))}
          </div>

          {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}

          {lookupMode === "song" ? (
            <div className="space-y-3">
              <Input
                value={songTitle}
                onChange={(e) => onChange({ ...value, songTitle: e.target.value })}
                placeholder="Song title"
                className="h-11 border-border bg-card/60 focus-visible:ring-primary"
              />
              <Input
                value={artists[0] ?? ""}
                onChange={(e) => setArtist(0, e.target.value)}
                placeholder="Artist (optional — helps narrow the lookup)"
                className="h-11 border-border bg-card/60 focus-visible:ring-primary"
              />
              <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3 shrink-0 text-signal-mid" />
                MusicBrainz covers most released recordings but not all — recent, obscure, or
                regional tracks often return &ldquo;not found.&rdquo; The style will still be
                inferred from training data, but with lower confidence.
              </p>
            </div>
          ) : (
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
          )}

          <div className={cn("mt-8 space-y-6", lookupMode === "song" && "hidden")}>
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {s.label}
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`What does ${s.label.toLowerCase()} mean?`}
                            className="text-muted-foreground/70 transition-colors hover:text-accent"
                          >
                            <Info className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64 text-xs leading-relaxed">
                          {s.hint}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-mono text-primary">{sliders[s.key]}</span>
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
            className="glow-primary mt-8 min-h-12 h-auto w-full gap-2 whitespace-normal py-3 font-display font-semibold"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading
              ? stage || (lookupMode === "song" ? "Analysing…" : "Blending…")
              : lookupMode === "song"
                ? result
                  ? "Re-analyse"
                  : "Analyse Song"
                : result
                  ? "Re-run With These Sliders"
                  : "Run Blend"}
          </Button>
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        {result ? (
          <>
            <Panel
              title="Style Breakdown"
              subtitle="Coherent, production-ready parameters."
              action={
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenSunoSheet}
                    className="gap-1.5 border-accent/50 bg-accent/10 text-xs text-accent hover:bg-accent/20"
                  >
                    <Send className="size-3.5" /> Suno Sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSendToForge(result)}
                    className="gap-1.5 border-primary/50 bg-primary/10 text-xs hover:bg-primary/20"
                  >
                    <Sparkles className="size-3.5" /> Send to Lyric Forge
                  </Button>
                </div>
              }
            >
              <ConfidenceLamp level={level} note={result.confidence?.note ?? ""} />
              {result.grounding?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.grounding.map((g) => (
                    <MbBadge key={g.name} info={g} showName />
                  ))}
                </div>
              ) : null}
              {result.styleWarnings?.length ? (
                <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-signal-mid/50 bg-signal-mid/10 px-3 py-2 text-xs">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-signal-mid" />
                  <p className="leading-relaxed text-foreground/90">
                    Suno blocks artist names, so these were stripped from the style fields:{" "}
                    <span className="font-mono text-signal-mid">
                      {result.styleWarnings.join(", ")}
                    </span>
                    . Re-run the blend if the style now reads oddly.
                  </p>
                </div>
              ) : null}
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
              {result.vocalPrompt ? (
                <div className="mt-3 rounded-lg border border-border bg-card/40 p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
                      Vocal Prompt
                    </span>
                    <CopyButton value={vocalString(result.vocalPrompt)} label="Copy vocal line" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReadoutField label="Voice" value={result.vocalPrompt.voice ?? "—"} />
                    <ReadoutField label="Delivery" value={result.vocalPrompt.delivery ?? "—"} />
                    <ReadoutField label="Harmonies" value={result.vocalPrompt.harmonies ?? "—"} />
                    <ReadoutField label="Effects" value={result.vocalPrompt.effects ?? "—"} />
                  </div>
                </div>
              ) : null}
              {result.excludeStyles ? (
                <div className="mt-3">
                  <ReadoutField label="Exclude Styles" value={result.excludeStyles} mono />
                </div>
              ) : null}
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
          <Panel title="Style Breakdown" className="flex h-full min-h-[440px] flex-col" action={<span className="font-mono text-xs text-muted-foreground">Awaiting input</span>}>
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-10 text-center">
              <span className="flex size-24 items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/5"><Radar className="size-10 text-primary" /></span>
              <h3 className="font-display text-2xl font-semibold text-foreground">Awaiting Sonic Blueprint</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Name one to three artists — the more specific the better. Try a contrast the model
                has to reconcile, like <span className="text-foreground">Johnny Cash + Burial</span>
                , rather than three artists from the same shelf.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange({ ...value, artists: DEMO });
                  void run(DEMO);
                }}
                className="mt-2 h-10 gap-2 border-border bg-secondary/40 text-xs text-foreground hover:bg-secondary"
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
