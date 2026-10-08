import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Gauge, Loader2, Scissors } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import type { CritiqueResult, CritiqueSlice, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

function grade(avg: number) {
  if (avg >= 9) return "A";
  if (avg >= 8) return "A-";
  if (avg >= 7) return "B+";
  if (avg >= 6) return "B";
  if (avg >= 5) return "C";
  if (avg >= 4) return "D";
  return "F";
}

function barTone(score: number) {
  if (score >= 8) return "bg-signal-high";
  if (score >= 5) return "bg-qc";
  return "bg-signal-low";
}

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
      <Panel title="Quality Control" subtitle="Blunt lyric autopsy. Nothing is uploaded or stored.">
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
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-qc"
              >
                Pull from Lyric Forge
              </Button>
            </div>
            <Textarea
              value={value.lyrics}
              onChange={(e) => onChange({ ...value, lyrics: e.target.value })}
              rows={12}
              placeholder="Paste the full draft, section tags and all…"
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-qc"
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
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-qc"
            />
          </div>
          <Button
            onClick={() => void run()}
            disabled={loading}
            className="h-11 w-full gap-2 bg-qc font-display tracking-wide text-qc-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--qc)_30%,transparent)] hover:bg-qc/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
            {loading ? "Reading it line by line…" : "Tear It Apart"}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No audio upload — describe the arrangement instead. The critique is only kept if you
            save this session.
          </p>
        </div>
      </Panel>

      <Panel
        title="Lyric Autopsy"
        subtitle={
          result?.verdict
            ? "Scored, quoted and prioritised."
            : "Scores, clichés, prosody and what to fix first."
        }
        action={plain ? <CopyButton value={plain} label="Copy notes" /> : undefined}
      >
        {result ? (
          <div className="space-y-4">
            {(() => {
              const sc = (result.scores ?? []).map((x) => Number(x.score ?? 0));
              const avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0;
              return (
                <div className="grid gap-4 rounded-lg border border-qc/40 bg-qc/5 p-4 sm:grid-cols-[auto_1fr]">
                  <div className="flex flex-col items-center justify-center rounded-md border border-qc/40 bg-card/70 px-5 py-3">
                    <span className="font-mono text-[9px] tracking-[0.25em] text-qc uppercase">
                      Readiness
                    </span>
                    <span className="font-display text-4xl font-bold text-qc">
                      {sc.length ? grade(avg) : "—"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {avg.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-foreground/90">{result.verdict}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className={cn("h-full rounded-full", barTone(avg))}
                        style={{ width: `${avg * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {result.scores?.length ? (
              <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
                <h3 className="font-mono text-[10px] tracking-[0.2em] text-qc uppercase">
                  Telemetry
                </h3>
                {result.scores.map((s, i) => {
                  const n = Number(s.score ?? 0);
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[10px] tracking-[0.18em] text-foreground/85 uppercase">
                          {s.label}
                        </span>
                        <span
                          className={cn(
                            "rounded border px-1.5 font-mono text-[11px]",
                            scoreTone(n),
                          )}
                        >
                          {n}/10
                        </span>
                      </div>
                      <div className="mt-1.5 flex gap-0.5" aria-hidden>
                        {Array.from({ length: 10 }, (_, j) => (
                          <span
                            key={j}
                            className={cn(
                              "h-1.5 flex-1 rounded-[1px]",
                              j < n ? barTone(n) : "bg-muted",
                            )}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {result.cliches?.length ? (
              <div className="rounded-lg border border-destructive/30 bg-card/60 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-destructive uppercase">
                  <Scissors className="size-3.5" /> Redline — clichés caught
                </h3>
                <ul className="space-y-3">
                  {result.cliches.map((c, i) => (
                    <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                      <p className="text-sm text-foreground/90 line-through decoration-destructive/60">
                        {c.line}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{c.why}</p>
                      <div className="mt-1.5 flex items-start gap-2">
                        <p className="flex-1 text-sm text-signal-high">
                          <span className="mr-1.5 font-mono text-[10px] uppercase">→</span>
                          {c.fix}
                        </p>
                        <CopyButton value={c.fix ?? ""} size="icon" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.prosody?.length ? (
              <div className="rounded-lg border border-border bg-card/60 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-qc uppercase">
                  <AlertTriangle className="size-3.5" /> Prosody warnings
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
              <div>
                <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-qc uppercase">
                  Priority repair tickets
                </h3>
                <ol className="grid gap-2 md:grid-cols-3">
                  {result.fixFirst.map((f, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-2 rounded-lg border border-qc/40 bg-qc/5 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-[0.2em] text-qc uppercase">
                          P{i + 1} · Ticket
                        </span>
                        <CopyButton value={f} size="icon" />
                      </div>
                      <span className="text-sm text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-qc/30 px-6 text-center">
            <Gauge className="size-8 text-qc" />
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
