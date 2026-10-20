import { Check, PenLine, RefreshCw, Stethoscope, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SoundProfiles } from "./SoundProfiles";
import { StyleVariants } from "./StyleVariants";
import type { BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/stats";
import { QUICK_SYMPTOMS } from "@/lib/symptoms";
import { newTake, type Take } from "@/lib/takes";
import { cn } from "@/lib/utils";

type Verdict = null | "up" | "down";

/**
 * Closes the loop after "Copy for Suno": the person generates in Suno, comes back and
 * says how the take came out. A keeper → save the sound / log it / write lyrics.
 * Not quite → generate again, try different prompts, or go to Fix a Track with the
 * problems already ticked. Nothing happens without a click.
 */
export function TakeCheck({
  blend,
  onBlend,
  takes,
  onTakes,
  onFix,
  onWriteLyrics,
  highlight = false,
}: {
  blend: BlendSlice;
  onBlend: (next: BlendSlice) => void;
  takes: Take[];
  onTakes: (next: Take[]) => void;
  /** Opens Fix a Track with these problems ticked. */
  onFix: (symptoms: string[]) => void;
  onWriteLyrics: () => void;
  /** True right after Copy for Suno, so the card draws the eye. */
  highlight?: boolean;
}) {
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [logged, setLogged] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  const style = blend.result?.styleTag ?? "";
  const exclude = blend.result?.excludeStyles ?? "";
  const name = blend.artists.filter((a) => a.trim()).slice(0, 2).join(" × ");

  const logTake = (rating: Take["rating"], note: string) => {
    if (logged || !style.trim()) return;
    onTakes([...takes, newTake(style, exclude, rating, note)]);
    track("take_logged", String(rating));
    setLogged(true);
  };

  const choose = (v: Exclude<Verdict, null>) => {
    setVerdict(v);
    track("start_choice", v === "up" ? "take_keeper" : "take_not_quite", { once: true });
  };

  const toggle = (s: string) =>
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <section
      aria-label="How did the take come out?"
      className={cn(
        "rounded-xl border bg-card/40 p-4 transition-colors",
        highlight && !verdict ? "border-primary/60 shadow-[0_0_0_1px_var(--primary)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Generated it? How did it come out?</h3>
          <p className="text-xs text-muted-foreground">
            Listen in Suno first. Only download the keeper; Suno limits downloads.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Rate the take">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={verdict === "up"}
            onClick={() => choose("up")}
            className={cn("gap-1.5", verdict === "up" && "border-signal-high/60 bg-signal-high/10 text-signal-high")}
          >
            <ThumbsUp className="size-4" /> Keeper
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={verdict === "down"}
            onClick={() => choose("down")}
            className={cn("gap-1.5", verdict === "down" && "border-destructive/60 bg-destructive/10 text-destructive")}
          >
            <ThumbsDown className="size-4" /> Not quite
          </Button>
        </div>
      </div>

      {verdict === "up" ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="mb-2 text-sm font-medium">Save this sound to reuse it for the next track or an album</p>
            <SoundProfiles blend={blend} onBlend={onBlend} suggestedName={name} hideList />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logged}
              onClick={() => {
                logTake(5, "Keeper from the Band Blender");
                toast.success("Logged as a keeper. Add its Suno link in Fix a Track's take log to share it as a recipe.");
              }}
              className="gap-1.5 text-xs"
            >
              <Check className="size-3.5" /> {logged ? "Logged as a keeper" : "Log as a keeper"}
            </Button>
            <Button type="button" size="sm" onClick={onWriteLyrics} className="gap-1.5 text-xs">
              <PenLine className="size-3.5" /> Write lyrics next
            </Button>
          </div>
        </div>
      ) : null}

      {verdict === "down" ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex gap-3 rounded-lg bg-background/40 p-3">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm">
              <span className="font-medium">Often the quickest fix is to generate again.</span>{" "}
              <span className="text-muted-foreground">
                Suno gives a different take every time, and 2–3 tries is normal. Listening is free; only
                downloads are limited.
              </span>
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowVariants((v) => !v)}
              className="gap-1.5 text-xs"
            >
              {showVariants ? "Hide" : "Try"} three different versions of the prompt
            </Button>
            {showVariants ? (
              <div className="mt-3">
                <StyleVariants blend={blend} onBlend={onBlend} />
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Something specific wrong? Pick what you heard</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SYMPTOMS.map((s) => {
                const on = picked.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                logTake(2, picked.length ? picked.join("; ") : "Not quite (from the Band Blender)");
                onFix(picked);
              }}
              className="mt-3 gap-1.5 text-xs"
            >
              <Stethoscope className="size-3.5" /> Fix this take
            </Button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Opens Fix a Track with your style prompt and these problems filled in. There are more options there,
              and you can add timestamps.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
