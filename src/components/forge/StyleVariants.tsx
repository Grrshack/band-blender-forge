import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote } from "./Field";
import { useSettings } from "./settings";
import type { BlendSlice, StyleVariant } from "./types";
import { Button } from "@/components/ui/button";
import { runForge } from "@/lib/forge.functions";
import { SUNO_LIMITS } from "@/lib/suno";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  safe: "border-signal-high/40 text-signal-high",
  experimental: "border-accent/50 text-accent",
  hybrid: "border-primary/50 text-primary",
};

/** Three alternative style prompts for the same song, so three Suno takes actually differ. */
export function StyleVariants({
  blend,
  onBlend,
}: {
  blend: BlendSlice;
  onBlend: (next: BlendSlice) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const result = blend.result;
  const style = result?.styleTag ?? "";
  const variants = result?.variants ?? [];

  const run = async () => {
    if (!style.trim()) {
      setError("Write or generate a style prompt first — the variants are built from it.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "variants",
          routing,
          apiKey,
          payload: {
            artists: blend.artists.filter((a) => a.trim()),
            style,
            exclude: result?.excludeStyles ?? "",
            genre: result?.genre ?? "",
            mood: result?.mood ?? "",
          },
        },
      });
      const out = JSON.parse(res.json) as { variants?: StyleVariant[]; styleWarnings?: string[] };
      if (!out.variants?.length) throw new Error("No variants came back — try again.");
      setWarnings(out.styleWarnings ?? []);
      onBlend({ ...blend, result: { ...(result ?? {}), variants: out.variants } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate variants.");
    } finally {
      setLoading(false);
    }
  };

  const use = (v: StyleVariant) =>
    onBlend({
      ...blend,
      result: { ...(result ?? {}), styleTag: v.styleTag, excludeStyles: v.excludeStyles },
    });

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Three takes, three angles
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void run()}
          className="h-8 gap-1.5 border-primary/50 bg-primary/10 text-xs hover:bg-primary/20"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FlaskConical className="size-3.5" />
          )}
          {loading
            ? "Writing variants…"
            : variants.length
              ? "Regenerate variants"
              : "Generate 3 variants"}
        </Button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Suno is random, so three different prompts beat rerunning one. Generate a take from each.
      </p>
      {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
      {warnings.length ? (
        <p className="mb-2 rounded-md border border-signal-mid/50 bg-signal-mid/10 px-3 py-2 text-xs text-foreground/90">
          Artist names were stripped (Suno blocks them):{" "}
          <span className="font-mono text-signal-mid">{warnings.join(", ")}</span>
        </p>
      ) : null}
      {variants.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {variants.map((v) => (
            <div
              key={v.label}
              className="flex flex-col rounded-lg border border-border bg-background/40 p-3"
            >
              <span
                className={cn(
                  "mb-2 w-fit rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase",
                  TONE[v.label.toLowerCase()] ?? "border-border text-muted-foreground",
                )}
              >
                {v.label}
              </span>
              <p className="mb-2 text-xs text-muted-foreground">{v.angle}</p>
              <p className="flex-1 font-mono text-xs leading-relaxed break-words text-accent">
                {v.styleTag}
              </p>
              <p
                className={cn(
                  "mt-2 font-mono text-[10px]",
                  v.styleTag.length > SUNO_LIMITS.style
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {v.styleTag.length.toLocaleString()} / {SUNO_LIMITS.style.toLocaleString()}
              </p>
              {v.excludeStyles ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Exclude: {v.excludeStyles}
                </p>
              ) : null}
              {v.vocalLine ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Vocal: {v.vocalLine}</p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => use(v)}
                  className="h-7 flex-1 text-xs"
                >
                  Use this style
                </Button>
                <CopyButton value={v.styleTag} size="icon" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
