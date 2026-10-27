import { ArrowRight, Check, ChevronDown, Circle, ExternalLink, PartyPopper, Star } from "lucide-react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/audio/song-analysis";
import { nextStep, readinessPct, songSteps } from "@/lib/song-status";
import { cn } from "@/lib/utils";

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The song's home: how far along it is, the one next step, and every take with its checks. */
export function SongHub({ state, onGoTab }: { state: ForgeState; onGoTab: (tab: string) => void }) {
  const steps = songSteps(state);
  const next = nextStep(steps);
  const pct = readinessPct(steps);
  const takes = [...state.takes].reverse();
  const style = state.blend.result?.styleTag ?? "";

  return (
    <div className="space-y-5">
      <Panel
        title={state.lyrics.title || "This song"}
        subtitle="Everything about this song in one place. Saved with the song (in this browser, or your account when signed in); no audio is stored."
      >
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Ready to release</span>
          <span className="font-mono text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-card" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onGoTab(s.tab)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50",
                  s.done ? "border-signal-high/40 bg-signal-high/5" : next?.id === s.id ? "border-primary/60 bg-primary/10" : "border-border",
                )}
              >
                {s.done ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-signal-high" />
                ) : (
                  <Circle className={cn("mt-0.5 size-4 shrink-0", next?.id === s.id ? "text-primary" : "text-muted-foreground")} />
                )}
                <span className="min-w-0">
                  <span className="block text-sm">
                    {s.label}
                    {s.optional && !s.done ? <span className="text-xs text-muted-foreground"> (optional)</span> : null}
                  </span>
                  {s.detail ? <span className="block truncate text-xs text-muted-foreground">{s.detail}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          {next ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Next step</p>
                <p className="font-medium">{next.action}</p>
              </div>
              <Button onClick={() => onGoTab(next.tab)} className="glow-primary gap-1.5">
                Go <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <PartyPopper className="size-5 text-primary" />
              <p className="min-w-0 flex-1 font-medium">Ready to release. Make clips to promote it.</p>
              <Button onClick={() => onGoTab("promo")} className="gap-1.5">
                Promo Clips <ArrowRight className="size-4" />
              </Button>
            </>
          )}
        </div>
      </Panel>

      <Panel title={`Takes (${state.takes.length})`} subtitle="Every version you logged, newest first, with the checks you ran on it.">
        {takes.length ? (
          <ul className="space-y-2">
            {takes.map((t, i) => {
              const lyric = t.checks?.lyric;
              const compare = t.checks?.compare;
              return (
                <li key={t.id} className={cn("rounded-lg border p-3", t.rating >= 5 ? "border-signal-high/40" : "border-border")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">Take {state.takes.length - i}</span>
                    <span className="flex items-center gap-0.5 text-amber-400" aria-label={`${t.rating} stars`}>
                      {Array.from({ length: t.rating }, (_, k) => (
                        <Star key={k} className="size-3 fill-current" />
                      ))}
                    </span>
                    {t.rating >= 5 ? <span className="rounded-full bg-signal-high/15 px-2 text-xs text-signal-high">Keeper</span> : null}
                    <span className="text-xs text-muted-foreground">{date(t.at)}</span>
                    {t.downloaded ? <span className="text-xs text-muted-foreground">· downloaded</span> : null}
                    {t.sunoUrl ? (
                      <a href={t.sunoUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2">
                        Open in Suno <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                  {t.note ? <p className="mt-1 text-sm text-muted-foreground">{t.note}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {lyric ? (
                      <span className={cn("rounded-full border px-2 py-0.5", lyric.accuracyPct >= 90 ? "border-signal-high/40 text-signal-high" : "border-amber-500/40 text-amber-300")}>
                        Lyrics {lyric.accuracyPct}% as written
                        {lyric.issues.length ? ` · ${lyric.issues.length} to check` : ""}
                      </span>
                    ) : (
                      <button type="button" onClick={() => onGoTab("lyriccheck")} className="rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">
                        + Lyric check
                      </button>
                    )}
                    {compare ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {compare.matchPct}% match to {compare.reference || "the reference"}
                      </span>
                    ) : (
                      <button type="button" onClick={() => onGoTab("songcompare")} className="rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">
                        + Compare with a song you love
                      </button>
                    )}
                  </div>
                  {lyric?.issues.length || compare?.differs.length ? (
                    <details className="group mt-2">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-primary [&::-webkit-details-marker]:hidden">
                        What the checks found <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {lyric?.issues.map((x, k) => (
                          <li key={`l${k}`}>
                            <span className="font-mono text-muted-foreground">{x.time !== null ? formatTime(x.time) : "—"}</span>{" "}
                            {x.status === "missing" ? "Not heard: " : "Sung differently: "}
                            {x.line}
                          </li>
                        ))}
                        {compare?.differs.length ? <li>Different from the reference: {compare.differs.join(", ")}</li> : null}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No takes yet. After you generate in Suno, rate each take in Fix a Track or the &quot;How did it come out?&quot; card,
            so this page can track them.
          </p>
        )}
      </Panel>

      {style ? (
        <Panel title="The sound" subtitle="The style prompt this song uses.">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card/40 p-3">
            <p className="flex-1 font-mono text-xs text-accent">{style}</p>
            <CopyButton value={style} size="icon" />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
