import { ExternalLink, Share2, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bestTake, diffTags, isSunoUrl, newTake, tagPatterns, type Take } from "@/lib/takes";
import { cn } from "@/lib/utils";
import { track } from "@/lib/stats";

/** Log each generated take with a rating, see what changed between versions, and restore any prompt. */
export function TakeLog({
  takes,
  onTakes,
  style,
  exclude,
  onRestore,
  onShareRecipe,
  defaultTitle = "",
}: {
  /** Shares a kept take (5 stars, with a Suno link) to the community as a recipe. */
  onShareRecipe?: (take: Take, title: string) => Promise<void>;
  defaultTitle?: string;
  takes: Take[];
  onTakes: (next: Take[]) => void;
  style: string;
  exclude: string;
  onRestore: (style: string, exclude: string) => void;
}) {
  const [rating, setRating] = useState<Take["rating"]>(3);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const linkBad = link.trim() !== "" && !isSunoUrl(link);

  const best = useMemo(() => bestTake(takes), [takes]);
  const patterns = useMemo(() => tagPatterns(takes), [takes]);

  const log = () => {
    if (!style.trim()) return;
    if (linkBad) return;
    onTakes([...takes, newTake(style, exclude, rating, note, new Date(), link)]);
    track("take_logged", String(rating));
    setNote("");
    setLink("");
  };

  const ordered = [...takes].map((t, i) => ({ t, prev: takes[i - 1] ?? null })).reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card/40 p-3">
        <span className="mb-1 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Log the take you just generated
        </span>
        <p className="mb-2 text-xs text-muted-foreground">
          Rate takes by listening on Suno. Downloads are limited (free: 7 ever; Pro: 20 a month;
          Premier: 60), so download only the keeper.
        </p>
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
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            maxLength={300}
            inputMode="url"
            aria-invalid={linkBad}
            placeholder="Suno link (optional)"
            className={cn(
              "h-9 min-w-[160px] flex-1 border-border bg-card/60 text-sm focus-visible:ring-primary",
              linkBad && "border-destructive",
            )}
          />
          <Button
            type="button"
            size="sm"
            disabled={!style.trim() || linkBad}
            onClick={log}
            className="h-9 text-xs"
          >
            Log this take
          </Button>
        </div>
        {linkBad ? (
          <p className="mt-2 text-xs text-destructive">Use the song's link from suno.com.</p>
        ) : null}
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
                    <label className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(t.downloaded)}
                        onChange={(e) =>
                          onTakes(takes.map((x) => (x.id === t.id ? { ...x, downloaded: e.target.checked } : x)))
                        }
                        className="size-3.5 accent-primary"
                      />
                      Downloaded
                    </label>
                    {t.sunoUrl ? (
                      <a
                        href={t.sunoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-foreground/90 hover:border-primary/50"
                      >
                        <ExternalLink className="size-3" /> Listen
                      </a>
                    ) : null}
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
                {t.rating === 5 && onShareRecipe ? (
                  <RecipeShare
                    take={t}
                    defaultTitle={defaultTitle}
                    onAddLink={(url) =>
                      onTakes(takes.map((x) => (x.id === t.id ? { ...x, sunoUrl: url } : x)))
                    }
                    onShare={onShareRecipe}
                  />
                ) : null}
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

/** For a 5-star take: add its Suno link if missing, then share it as a community recipe. */
function RecipeShare({
  take,
  defaultTitle,
  onAddLink,
  onShare,
}: {
  take: Take;
  defaultTitle: string;
  onAddLink: (url: string) => void;
  onShare: (take: Take, title: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState(defaultTitle || "My keeper");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="mt-2 text-xs text-signal-high">Shared to the community as a recipe.</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Share2 className="size-3" /> Share this keeper as a recipe
      </button>
    );
  }
  if (!take.sunoUrl) {
    const bad = url.trim() !== "" && !isSunoUrl(url);
    return (
      <div className="mt-2 space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2.5">
        <p className="text-xs text-foreground/90">
          Recipes include the song, so others can hear it worked. Paste its suno.com link.
        </p>
        <div className="flex gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://suno.com/song/…"
            aria-invalid={bad}
            className={cn("h-8 text-xs", bad && "border-destructive")}
          />
          <Button size="sm" className="h-8" disabled={!url.trim() || bad} onClick={() => onAddLink(url.trim())}>
            Add link
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 p-2.5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        aria-label="Recipe title"
        className="h-8 min-w-[160px] flex-1 text-xs"
      />
      <Button
        size="sm"
        className="h-8"
        disabled={busy || title.trim().length < 3}
        onClick={async () => {
          setBusy(true);
          try {
            await onShare(take, title.trim());
            setDone(true);
          } catch {
            /* the caller shows the error */
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sharing…" : "Share recipe"}
      </Button>
      <p className="w-full text-[11px] text-muted-foreground">
        Shares the style prompt, exclude list, your note and the Suno link. Everyone can see it.
      </p>
    </div>
  );
}
