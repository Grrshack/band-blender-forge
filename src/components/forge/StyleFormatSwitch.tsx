import { Loader2 } from "lucide-react";
import { useState } from "react";

import { useSettings } from "./settings";
import type { BlendResult } from "./types";
import { useForge } from "./use-forge";
import { PROMPT_FORMAT_LABELS, activeFormat, cleanBriefParts, swapFormat, type PromptFormat } from "@/lib/prompt-craft";
import { normalizeSunoVersion, type SunoVersion } from "@/lib/suno";
import { cn } from "@/lib/utils";

const HINT: Record<PromptFormat, string> = {
  tags: "Short comma-separated tags, genre first. Works on every Suno version.",
  brief: "A few plain sentences, like briefing a session band. v6 reads these well; try both on one song.",
};

/**
 * Tag list / Studio brief switch that sits on the style itself. Swapping is instant when both
 * versions exist; otherwise the other version is written with one AI call.
 */
export function StyleFormatSwitch({
  result,
  sunoVersion,
  onResult,
  onPreferred,
  compact = false,
}: {
  result: BlendResult;
  sunoVersion?: SunoVersion | undefined;
  onResult: (next: BlendResult) => void;
  /** Remembers the person's choice for the next blend. */
  onPreferred?: (f: PromptFormat) => void;
  compact?: boolean;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = activeFormat(result);

  const pick = async (f: PromptFormat) => {
    if (f === now || busy) return;
    setError(null);
    onPreferred?.(f);
    if (result.styleAlt) {
      onResult(swapFormat(result));
      return;
    }
    if (!result.styleTag?.trim()) return;
    setBusy(true);
    try {
      const res = await forge({
        data: {
          task: "refine",
          routing,
          apiKey,
          payload: { styleTag: result.styleTag, convertTo: f, instruction: `Rewrite as ${PROMPT_FORMAT_LABELS[f]}`, sunoVersion: normalizeSunoVersion(sunoVersion) },
        },
      });
      const out = JSON.parse(res.json) as { styleTag?: string; styleBriefParts?: unknown };
      if (!out.styleTag?.trim()) throw new Error("No style came back. Try again.");
      const parts = f === "brief" ? cleanBriefParts(out.styleBriefParts) : null;
      onResult({
        ...result,
        styleTag: out.styleTag,
        styleAlt: result.styleTag,
        styleFormat: f,
        ...(parts ? { briefParts: parts } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rewrite the style.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(compact ? "" : "mb-2")}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Style format" className="inline-flex rounded-md border border-border p-0.5">
          {(Object.keys(PROMPT_FORMAT_LABELS) as PromptFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={now === f}
              disabled={busy}
              onClick={() => void pick(f)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors",
                now === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PROMPT_FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        {busy ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Writing the {PROMPT_FORMAT_LABELS[now === "tags" ? "brief" : "tags"].toLowerCase()}…
          </span>
        ) : compact ? null : (
          <span className="text-[11px] text-muted-foreground">{HINT[now]}</span>
        )}
      </div>
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * For a Studio Brief that has no saved parts (made before parts existed, or the AI didn't split
 * it): one AI call splits it into the six labelled parts, keeping the wording.
 */
export function BriefSplitButton({
  result,
  sunoVersion,
  onResult,
}: {
  result: BlendResult;
  sunoVersion?: SunoVersion | undefined;
  onResult: (next: BlendResult) => void;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = async () => {
    if (!result.styleTag?.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await forge({
        data: {
          task: "refine",
          routing,
          apiKey,
          payload: { styleTag: result.styleTag, splitBrief: true, instruction: "Split into Studio Brief parts", sunoVersion: normalizeSunoVersion(sunoVersion) },
        },
      });
      const out = JSON.parse(res.json) as { styleTag?: string; styleBriefParts?: unknown };
      const parts = cleanBriefParts(out.styleBriefParts);
      if (!parts || !out.styleTag?.trim()) throw new Error("The parts didn't come back. Try again.");
      onResult({ ...result, styleTag: out.styleTag, briefParts: parts, styleFormat: "brief" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't split the brief.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void split()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
        {busy ? "Splitting into parts…" : "Show it part by part"}
      </button>
      <span className="text-[11px] text-muted-foreground">Sound, Pulse, Players, Voice, Arc, Finish. One AI call.</span>
      {error ? <span className="w-full text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
