import { useServerFn } from "@tanstack/react-start";
import { ChevronUp, Clipboard, FlaskConical, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { currentDrop, dropLabel } from "@/lib/lab";
import { listLiveLabPicks, listWeeklyTop, type LabPick } from "@/lib/lab.functions";

/**
 * Top of the community library: this week's Lab Picks and the five most-upvoted prompts of
 * the last 7 days. Shows nothing until there's something to show.
 */
export function LabPicksStrip({ onApply }: { onApply: (kind: string, body: string) => void }) {
  const loadPicks = useServerFn(listLiveLabPicks);
  const loadTop = useServerFn(listWeeklyTop);
  const [picks, setPicks] = useState<LabPick[]>([]);
  const [top, setTop] = useState<Array<LabPick & { votes: number }>>([]);

  useEffect(() => {
    void loadPicks()
      .then((p) => setPicks(currentDrop(p)))
      .catch(() => setPicks([]));
    void loadTop()
      .then(setTop)
      .catch(() => setTop([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!picks.length && !top.length) return null;

  const apply = (p: LabPick) => {
    onApply("style", p.style_tag);
    toast.success(`"${p.title}" is in the Band Blender.`);
  };

  return (
    <div className="space-y-3">
      {picks.length ? (
        <section
          aria-label="Lab Picks"
          className="rounded-xl border border-accent/40 bg-accent/5 p-4 shadow-[0_0_24px_color-mix(in_oklab,var(--accent)_12%,transparent)]"
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <FlaskConical className="size-4" /> Lab Picks
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground">{dropLabel(picks[0]!.drop_at ?? "")}</span>
            <span className="text-xs text-muted-foreground">Fresh blends to try. New drops on Mondays and Fridays.</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  {p.artists.length ? (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{p.artists.join(" × ")}</p>
                  ) : null}
                </div>
                <p className="line-clamp-3 font-mono text-[10px] leading-relaxed text-foreground/80">{p.style_tag}</p>
                <div className="mt-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => apply(p)}
                    className="flex-1 rounded border border-accent/40 bg-accent/10 py-1 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20"
                  >
                    Apply to blend
                  </button>
                  <button
                    type="button"
                    aria-label={`Copy the style for ${p.title}`}
                    onClick={() => void navigator.clipboard.writeText(p.style_tag).then(() => toast.success("Style copied."))}
                    className="rounded border border-border p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Clipboard className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {top.length ? (
        <section aria-label="Top 5 this week" className="rounded-xl border border-border bg-card/40 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="size-4 text-signal-mid" /> Top {top.length} this week
            <span className="text-xs font-normal text-muted-foreground">most upvoted in the last 7 days</span>
          </h3>
          <ol className="space-y-1.5">
            {top.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {p.title}
                  {p.artists.length ? (
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{p.artists.join(" × ")}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-muted-foreground">
                  <ChevronUp className="size-3" />
                  {p.votes}
                </span>
                <button
                  type="button"
                  onClick={() => apply(p)}
                  className="rounded border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/15"
                >
                  Apply
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
