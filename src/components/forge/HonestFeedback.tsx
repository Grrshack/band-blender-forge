import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Scissors } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import type { CritiqueResult, CritiqueSlice, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

function scoreTone(score: number) {
  if (score >= 8) return "text-signal-high border-signal-high/40 bg-signal-high/10";
  if (score >= 5) return "text-signal-mid border-signal-mid/40 bg-signal-mid/10";
  return "text-signal-low border-signal-low/40 bg-signal-low/10";
}

export function HonestFeedback({
  value,
  onChange,
  lyrics,
}: {
  value: CritiqueSlice;
  onChange: (next: CritiqueSlice) => void;
  lyrics: LyricSlice;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = value.result;

  const pullFromForge = () => {
    const text = lyrics.sections
      .map((s) => `${s.tag}\n${s.lines.map((l) => l.text).join("\n")}`)
      .join("\n\n");
    if (!text.trim()) {
      setError("Nothing in the Lyric Forge yet.");
      return;
    }
    setError(null);
    onChange({ ...value, lyrics: text });
  };

  const run = async () => {
    if (!value.lyrics.trim()) {
      setError("Paste the lyrics you want torn apart.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "critique",
          routing,
          apiKey,
          payload: { lyrics: value.lyrics, trackNotes: value.notes },
        },
      });
      onChange({ ...value, result: JSON.parse(res.json) as CritiqueResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Critique failed.");
    } finally {
      setLoading(false);
    }
  };

  const plain = result
    ? [
        result.verdict ?? "",
        (result.scores ?? []).map((s) => `${s.label}: ${s.score}/10 — ${s.note}`).join("\n"),
        (result.fixFirst ?? []).map((f, i) => `${i + 1}. ${f}`).join("\n"),
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Panel title="Honest Feedback" subtitle="Blunt critique. Nothing is uploaded or stored.">
        {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Lyrics
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={pullFromForge}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary"
              >
                Pull from Lyric Forge
              </Button>
            </div>
            <Textarea
              value={value.lyrics}
              onChange={(e) => onChange({ ...value, lyrics: e.target.value })}
              rows={12}
              placeholder="Paste the full draft, section tags and all…"
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Track notes
            </span>
            <Textarea
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              rows={4}
              placeholder="92 bpm, half-time chorus, male baritone, worried the bridge kills the momentum…"
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
          </div>
          <Button
            onClick={() => void run()}
            disabled={loading}
            className="glow-primary h-11 w-full gap-2 font-display tracking-wide"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
            {loading ? "Reading it line by line…" : "Tear It Apart"}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No audio upload — describe the arrangement instead. The critique is only kept if you save
            this session.
          </p>
        </div>
      </Panel>

      <Panel
        title="The Verdict"
        subtitle={
          result?.verdict ? "Scored, quoted and prioritised." : "Scores, clichés, prosody and what to fix first."
        }
        action={plain ? <CopyButton value={plain} label="Copy notes" /> : undefined}
      >
        {result ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90">
              {result.verdict}
            </p>

            {result.scores?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {result.scores.map((s, i) => (
                  <div
                    key={i}
                    className={cn("rounded-lg border p-3", scoreTone(Number(s.score ?? 0)))}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
                        {s.label}
                      </span>
                      <span className="font-display text-lg font-bold">{s.score}/10</span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/80">{s.note}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {result.cliches?.length ? (
              <div className="rounded-lg border border-border bg-card/60 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  <Scissors className="size-3.5" /> Clichés caught
                </h3>
                <ul className="space-y-3">
                  {result.cliches.map((c, i) => (
                    <li key={i} className="border-l-2 border-destructive/60 pl-3">
                      <p className="text-sm text-foreground/90 line-through decoration-destructive/60">
                        {c.line}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{c.why}</p>
                      <div className="mt-1.5 flex items-start gap-2">
                        <p className="flex-1 text-sm text-accent">{c.fix}</p>
                        <CopyButton value={c.fix ?? ""} size="icon" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.prosody?.length ? (
              <div className="rounded-lg border border-border bg-card/60 p-4">
                <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Hard to sing
                </h3>
                <ul className="space-y-2">
                  {result.prosody.map((p, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-foreground/90">{p.line}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{p.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.fixFirst?.length ? (
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
                <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
                  Fix these first
                </h3>
                <ol className="space-y-2">
                  {result.fixFirst.map((f, i) => (
                    <li key={i} className="flex gap-3 text-sm text-foreground/90">
                      <span className="font-display font-bold text-accent">{i + 1}</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 text-center">
            <Gauge className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You get scores with reasons, every cliché quoted back with a replacement line, the
              lines that fight the melody, and three fixes in priority order.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
