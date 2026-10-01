import { Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bestTake, diffTags, newTake, tagPatterns, type Take } from "@/lib/takes";
import { cn } from "@/lib/utils";

/** Log each generated take with a rating, see what changed between versions, and restore any prompt. */
export function TakeLog({
  takes,
  onTakes,
  style,
  exclude,
  onRestore,
}: {
  takes: Take[];
  onTakes: (next: Take[]) => void;
  style: string;
  exclude: string;
  onRestore: (style: string, exclude: string) => void;
}) {
  const [rating, setRating] = useState<Take["rating"]>(3);
  const [note, setNote] = useState("");

  const best = useMemo(() => bestTake(takes), [takes]);
  const patterns = useMemo(() => tagPatterns(takes), [takes]);

  const log = () => {
    if (!style.trim()) return;
    onTakes([...takes, newTake(style, exclude, rating, note)]);
    setNote("");
  };

  const ordered = [...takes].map((t, i) => ({ t, prev: takes[i - 1] ?? null })).reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Log the take you just generated
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-0.5" role="radiogroup" aria-label="Rating">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className="rounded p-1"
              >
                <Star
                  className={cn(
                    "size-5 transition-colors",
                    n <= rating ? "fill-accent text-accent" : "text-muted-foreground/50",
                  )}
                />
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="What was it like? (optional)"
            className="h-9 min-w-[180px] flex-1 border-border bg-card/60 text-sm focus-visible:ring-primary"
          />
          <Button
            type="button"
            size="sm"
            disabled={!style.trim()}
            onClick={log}
            className="h-9 text-xs"
          >
            Log this take
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Saves the style prompt above with your rating. The diagnosis uses your last few takes, so
          it stops repeating changes that didn't help.
        </p>
      </div>

      {patterns.enough && (patterns.helped.length > 0 || patterns.hurt.length > 0) ? (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
          <span className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
            Patterns in your ratings
          </span>
          {patterns.helped.length ? (
            <p className="text-foreground/90">
              In every take you liked, never in one you didn't:{" "}
              <span className="font-mono text-signal-high">{patterns.helped.join(", ")}</span>
            </p>
          ) : null}
          {patterns.hurt.length ? (
            <p className="mt-1 text-foreground/90">
              In every take you disliked, never in one you liked:{" "}
              <span className="font-mono text-destructive">{patterns.hurt.join(", ")}</span>
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            With only a few takes this can be coincidence — treat it as a hint.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Patterns appear once you've logged at least two takes you liked (4–5★) and two you didn't
          (1–2★).
        </p>
      )}

      {ordered.length ? (
        <ul className="space-y-2">
          {ordered.map(({ t, prev }) => {
            const d = prev ? diffTags(prev.style, t.style) : null;
            return (
              <li key={t.id} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex" aria-label={`${t.rating} of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "size-3.5",
                          n <= t.rating ? "fill-accent text-accent" : "text-muted-foreground/40",
                        )}
                      />
                    ))}
                  </span>
                  {best?.id === t.id ? (
                    <span className="rounded-full border border-signal-high/40 bg-signal-high/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-signal-high uppercase">
                      Best so far
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(t.at).toLocaleString()}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRestore(t.style, t.exclude)}
                      className="h-7 text-xs"
                    >
                      Restore prompt
                    </Button>
                    <button
                      type="button"
                      title="Delete this take"
                      onClick={() => onTakes(takes.filter((x) => x.id !== t.id))}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
                {t.note ? <p className="mt-2 text-sm text-foreground/90">{t.note}</p> : null}
                {d && (d.added.length || d.removed.length) ? (
                  <p className="mt-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
                    <span className="text-muted-foreground">vs previous:</span>
                    {d.added.map((a) => (
                      <span key={"+" + a} className="text-signal-high">
                        +{a}
                      </span>
                    ))}
                    {d.removed.map((r) => (
                      <span key={"-" + r} className="text-destructive">
                        −{r}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-muted-foreground">
                  {t.style}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
