import { useServerFn } from "@tanstack/react-start";
import { Clipboard, Info, Loader2, Radar, Send, ShieldAlert, Sparkles, Wand } from "lucide-react";
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
import { SUNO_VERSION_LABELS, type SunoVersion, vocalString } from "@/lib/suno";
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

/** Pre-computed demo result shown before the user runs their first blend. */
const DEMO_BLEND: BlendResult = {
  confidence: { level: "high", note: "Demo result — replace with your own artists above" },
  genre: "Trip-hop / Art Pop",
  tempo: "70–88 BPM, dragging half-time feel",
  instrumentation: "Samplers, live strings, sub-heavy 808s, orchestral stabs, Rhodes piano",
  vocals: "Breathy alto, close-miked, intimate phrasing with occasional processed falsetto",
  mood: "Melancholic, cinematic, unsettled intimacy",
  styleTag:
    "trip-hop, dark art-pop, cinematic mood, 80bpm, sub bass, orchestral samples, breathy alto, lo-fi production, melancholic, introspective",
  vocalPrompt: {
    voice: "Warm breathy alto with restrained upper range",
    delivery: "Close-miked, half-spoken verses building to a contained belted chorus",
    harmonies: "Sparse high harmonics, single tracked at key phrase endings",
    effects: "Tape saturation, subtle pitch correction, long reverb tail on sustains",
  },
  excludeStyles: "euphoric, energetic, upbeat, acoustic folk, bright mix, arena rock",
  reconciliation:
    "The first artist's jazz-tinged sample manipulation and the second's dub-influenced sub pressure form the rhythmic foundation, while the third's avant-garde production sensibility — negative space and textural contrast — governs arrangement decisions. Vocal approach conflicts are resolved by favouring intimacy over cinematic distance, while keeping dense layering intact underneath.",
  recommendedSliders: { energy: 35, complexity: 72, brightness: 28 },
  sliderNotes: "Low energy and brightness reflect the slow, dark character; high complexity captures the layered production.",
};

const PRESETS: { label: string; emoji: string; artists: string[] }[] = [
  { label: "Dark Cinematic Trap", emoji: "🌑", artists: ["James Blake", "Travis Scott", "Arca"] },
  { label: "90s Grunge Revival", emoji: "🎸", artists: ["Nirvana", "Hole", "Pixies"] },
  { label: "Hyperpop", emoji: "⚡", artists: ["100 gecs", "Charli XCX", "SOPHIE"] },
  { label: "Lo-fi Jazz Hip-hop", emoji: "🌿", artists: ["Nujabes", "J Dilla", "Toro y Moi"] },
  { label: "Orchestral Metal", emoji: "🔥", artists: ["Rammstein", "Hans Zimmer", "Gojira"] },
];

/** Formats blend output into one pasteable block for Suno's custom mode. */
function formatForSuno(result: BlendResult): string {
  const parts: string[] = [];
  if (result.styleTag) parts.push(`Style: ${result.styleTag}`);
  const vocal = vocalString(result.vocalPrompt);
  if (vocal) parts.push(`Vocal style: ${vocal}`);
  if (result.excludeStyles) parts.push(`Exclude: ${result.excludeStyles}`);
  return parts.join("\n\n");
}

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

  const { artists, sliders, result, lookupMode = "band", songTitle = "", sunoVersion = "v6" } = value;

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
        : { artists: names, sliders, sunoVersion };
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
        sunoVersion,
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel
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
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...value, lookupMode: m, result: null })}
                className={cn(
                  "flex-1 rounded-md py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  lookupMode === m
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "band" ? "Band / Artist blend" : "Single song"}
              </button>
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

          <div className={cn("mt-5 space-y-4", lookupMode === "song" && "hidden")}>
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
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

          {/* Suno version selector */}
          {lookupMode === "band" && (
            <div className="mt-5">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Suno version
              </span>
              <div className="flex rounded-lg border border-border p-0.5">
                {(Object.keys(SUNO_VERSION_LABELS) as SunoVersion[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ ...value, sunoVersion: v })}
                    className={cn(
                      "flex-1 rounded-md py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                      sunoVersion === v
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {SUNO_VERSION_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick-start presets */}
          {lookupMode === "band" && !result && (
            <div className="mt-4">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Quick start
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, artists: [...p.artists, ""].slice(0, 3) });
                      void run([...p.artists]);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <span>{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={() => void run()}
            disabled={loading}
            className="glow-primary mt-5 h-11 w-full gap-2 font-display tracking-wide"
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

      <div className="space-y-5">
        {result ? (
          <>
            <Panel
              title="Style Breakdown"
              subtitle="Coherent, production-ready parameters."
              action={
                <div className="flex flex-wrap justify-end gap-1.5">
                  <CopyButton
                    value={formatForSuno(result)}
                    label={
                      <span className="flex items-center gap-1">
                        <Clipboard className="size-3" /> Copy for Suno
                      </span>
                    }
                    className="gap-1.5 border-border text-xs"
                  />
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
          <>
            {/* Demo banner */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
              <Wand className="size-3.5 shrink-0 text-primary" />
              <span>
                This is a demo blend —{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => {
                    onChange({ ...value, artists: DEMO });
                    void run(DEMO);
                  }}
                >
                  run {DEMO.join(" + ")}
                </button>{" "}
                or type your own artists above.
              </span>
            </div>
            {/* Render demo result using same layout as a real result */}
            <Panel
              title="Style Breakdown"
              subtitle="Demo result — run your own blend to replace this."
              action={
                <CopyButton
                  value={formatForSuno(DEMO_BLEND)}
                  label={
                    <span className="flex items-center gap-1">
                      <Clipboard className="size-3" /> Copy for Suno
                    </span>
                  }
                  className="gap-1.5 border-border text-xs"
                />
              }
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ReadoutField label="Genre" value={DEMO_BLEND.genre ?? "—"} />
                <ReadoutField label="Tempo" value={DEMO_BLEND.tempo ?? "—"} />
                <ReadoutField label="Instrumentation" value={DEMO_BLEND.instrumentation ?? "—"} />
                <ReadoutField label="Vocals" value={DEMO_BLEND.vocals ?? "—"} />
                <ReadoutField label="Mood" value={DEMO_BLEND.mood ?? "—"} />
              </div>
              <div className="mt-3">
                <ReadoutField label="Suno Style Tag Prompt" value={DEMO_BLEND.styleTag ?? "—"} mono accent />
              </div>
              {DEMO_BLEND.excludeStyles && (
                <div className="mt-3">
                  <ReadoutField label="Exclude Styles" value={DEMO_BLEND.excludeStyles} mono />
                </div>
              )}
            </Panel>
            <Panel title="Blend Reconciliation Logic" subtitle="How the conflicting styles are fused.">
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90">
                {DEMO_BLEND.reconciliation}
              </p>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
