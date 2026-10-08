import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Radar } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { MbBadge } from "./MbBadge";
import { useSettings } from "./settings";
import type { CompareResult, CompareSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

const SEEDS = [
  "90s trip-hop",
  "gritty 808s",
  "breathy female vocal",
  "dark synthwave",
  "shoegaze wall",
  "lo-fi tape hiss",
];
type Mode = "lyrics" | "style" | "both";

function Meter({ pct }: { pct: number }) {
  const on = Math.round(Math.max(0, Math.min(100, pct)) / 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1.5 rounded-[1px]",
              i < on ? "bg-radar shadow-[0_0_6px_var(--radar)]" : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] text-radar">{pct}%</span>
    </div>
  );
}

export function ComparableArtists({
  value,
  onChange,
  onSendToBlender,
}: {
  value: CompareSlice;
  onChange: (next: CompareSlice) => void;
  onSendToBlender?: (name: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("both");
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lyrics, tags, result } = value;

  const run = async () => {
    if (!lyrics.trim() && !tags.trim()) {
      setError("Paste lyrics or style tags first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "compare",
          routing,
          apiKey,
          payload: {
            lyrics: mode === "style" ? "" : lyrics,
            styleTags: mode === "lyrics" ? "" : tags,
          },
        },
      });
      onChange({ ...value, result: JSON.parse(res.json) as CompareResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const plain = (result?.artists ?? [])
    .map((a) => `${a.name}\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`)
    .join("\n\n");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Panel title="Acoustic Radar" subtitle="Scan lyrics, style DNA, or both.">
        <div
          role="radiogroup"
          aria-label="Scan mode"
          className="mb-4 grid grid-cols-3 gap-1 rounded-lg border border-radar/30 bg-card/60 p-1"
        >
          {(
            [
              ["lyrics", "Lyric scan"],
              ["style", "Style DNA"],
              ["both", "Combined"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase transition-colors",
                mode === m
                  ? "bg-radar text-radar-foreground"
                  : "text-muted-foreground hover:text-radar",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
        <div className="space-y-4">
          <div className={cn(mode === "style" && "hidden")}>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Your lyrics
            </span>
            <Textarea
              value={lyrics}
              onChange={(e) => onChange({ ...value, lyrics: e.target.value })}
              rows={10}
              placeholder={"Paste a verse or chorus here…"}
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-radar"
            />
          </div>
          <div className={cn(mode === "lyrics" && "hidden")}>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Style tags
            </span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SEEDS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      tags: tags.trim() ? `${tags.trim().replace(/,$/, "")}, ${t}` : t,
                    })
                  }
                  className="rounded-full border border-radar/30 px-2 py-0.5 font-mono text-[10px] text-radar/90 transition-colors hover:bg-radar/10"
                >
                  + {t}
                </button>
              ))}
            </div>
            <Textarea
              value={tags}
              onChange={(e) => onChange({ ...value, tags: e.target.value })}
              rows={3}
              placeholder="dark synthwave, 104 bpm, breathy female vocal, analog tape…"
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-radar"
            />
          </div>
          <Button
            onClick={() => void run()}
            disabled={loading}
            className="h-11 w-full gap-2 bg-radar font-display tracking-wide text-radar-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--radar)_35%,transparent)] hover:bg-radar/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading ? "Matching tone, then verifying the artists exist…" : "Run Radar Scan"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Reference Dossier"
        subtitle={result?.summary ?? "Real-world reference points with reasoning."}
        action={plain ? <CopyButton value={plain} label="Copy all" /> : undefined}
      >
        {result?.artists?.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {result.artists.map((a, i) => (
              <article
                key={i}
                className="relative overflow-hidden rounded-lg border border-radar/25 bg-card/70 p-4 transition-colors hover:border-radar/60"
              >
                <span className="absolute top-0 left-0 h-full w-0.5 bg-radar/70" aria-hidden />
                <p className="font-mono text-[9px] tracking-[0.25em] text-radar/70 uppercase">
                  Ref #{String(i + 1).padStart(2, "0")}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-foreground">{a.name}</h3>
                  <div className="flex items-center gap-2">
                    <CopyButton
                      value={`${a.name}\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`}
                      size="icon"
                    />
                  </div>
                </div>
                {typeof a.match === "number" ? (
                  <div className="mt-2">
                    <Meter pct={a.match} />
                  </div>
                ) : null}
                {a.mb ? (
                  <div className="mt-2">
                    <MbBadge info={a.mb} />
                  </div>
                ) : null}
                <ul className="mt-3 space-y-1.5">
                  {(a.reasoning ?? []).map((r, j) => (
                    <li key={j} className="flex gap-2 text-sm text-foreground/85">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-radar" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                {onSendToBlender && a.name ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSendToBlender(a.name ?? "")}
                    className="mt-3 h-7 gap-1.5 px-2 font-mono text-[10px] tracking-[0.15em] text-radar uppercase hover:bg-radar/10 hover:text-radar"
                  >
                    Send to Band Blender <ArrowRight className="size-3" />
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-radar/30 px-6 text-center">
            <span className="relative flex size-16 items-center justify-center rounded-full border border-radar/30">
              <span className="absolute inset-2 animate-ping rounded-full border border-radar/40" />
              <Radar className="size-7 text-radar" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Results appear here: three to four real artists with a bulleted reasoning breakdown.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
