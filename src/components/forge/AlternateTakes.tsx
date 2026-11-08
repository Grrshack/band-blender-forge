import { Layers, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorNote } from "./Field";
import type { BlendSlice } from "./types";
import { useForge } from "./use-forge";
import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_DIRECTIONS,
  MAX_DIRECTIONS,
  TAKE_DIRECTIONS,
  activeTakeId,
  directionsFor,
  removeTake,
  switchTake,
  takeFromAlternate,
  takesOf,
  withAlternates,
  type RawAlternate,
} from "@/lib/alt-takes";
import { cn } from "@/lib/utils";

/**
 * Tabs for the song's takes (Main, Darker, Bigger drop…). The open tab is what Copy, the Suno
 * Sheet and Send to Suno use. Shows nothing until there are alternates.
 */
export function TakeTabs({ blend, onBlend }: { blend: BlendSlice; onBlend: (next: BlendSlice) => void }) {
  const r = blend.result;
  const takes = takesOf(r);
  if (!r || takes.length < 2) return null;
  const active = activeTakeId(r);
  const open = takes.find((t) => t.id === active);
  return (
    <div className="space-y-1.5">
      <div role="tablist" aria-label="Takes" className="flex flex-wrap items-center gap-1">
        {takes.map((t) => (
          <span
            key={t.id}
            className={cn(
              "inline-flex items-center rounded-md border text-xs transition-colors",
              t.id === active ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={t.id === active}
              onClick={() => onBlend({ ...blend, result: switchTake(r, t.id) })}
              className="px-2.5 py-1"
            >
              {t.label}
            </button>
            {t.id !== "main" ? (
              <button
                type="button"
                aria-label={`Remove the ${t.label} take`}
                title="Remove this take"
                onClick={() => onBlend({ ...blend, result: removeTake(r, t.id) })}
                className="pr-1.5 opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {open?.angle ? <p className="text-[11px] text-muted-foreground">{open.angle}</p> : null}
      <p className="text-[11px] text-muted-foreground">
        The open take is what Copy, the Suno Sheet and Send to Suno use; edits stay with their take.
      </p>
    </div>
  );
}

/** Pick up to three directions and make them in one AI call. */
export function AlternateMaker({ blend, onBlend }: { blend: BlendSlice; onBlend: (next: BlendSlice) => void }) {
  const forge = useForge();
  const { apiKey } = useSettings();
  const [picked, setPicked] = useState<string[]>(DEFAULT_DIRECTIONS);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = blend.result;
  const style = r?.styleTag?.trim() ?? "";
  const dirs = directionsFor(picked, custom);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length + (custom.trim() ? 1 : 0) >= MAX_DIRECTIONS ? p : [...p, id]));

  const make = async () => {
    if (!r || !style) {
      setError("Make or paste a style first; the takes are built from it.");
      return;
    }
    if (!dirs.length) {
      setError("Pick at least one direction.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "alternates",
          routing: "fast",
          apiKey,
          payload: {
            style,
            excludeStyles: r.excludeStyles ?? "",
            genre: r.genre ?? "",
            directions: dirs,
            artists: blend.artists.map((a) => a.trim()).filter(Boolean),
            sunoVersion: blend.sunoVersion,
          },
        },
      });
      const out = JSON.parse(res.json) as { alternates?: RawAlternate[] };
      const format = r.styleFormat ?? blend.promptFormat ?? "brief";
      const alts = (out.alternates ?? []).map((a, i) => takeFromAlternate(a, format, i + 2)).filter((a) => a !== null);
      if (!alts.length) throw new Error("No takes came back. Try again.");
      onBlend({ ...blend, result: withAlternates(r, alts) });
      toast.success(`Made ${alts.map((a) => a.label).join(" and ")}. Flip through the tabs above the style.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the takes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Layers className="size-4 text-primary" /> Alternate takes
      </p>
      <p className="text-xs text-muted-foreground">
        The same song pushed in a direction, each in both formats, as tabs next to your main style. Pick up to{" "}
        {MAX_DIRECTIONS}. One AI call makes them all.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TAKE_DIRECTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={picked.includes(d.id)}
            onClick={() => toggle(d.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              picked.includes(d.id)
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="or your own: more 80s…"
          maxLength={60}
          className="h-7 w-44 text-xs"
          aria-label="Your own direction"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void make()} disabled={loading || !dirs.length} className="gap-1.5 text-xs">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          {loading ? "Making takes…" : `Make ${dirs.length || ""} take${dirs.length === 1 ? "" : "s"}`.replace("  ", " ")}
        </Button>
        {dirs.length ? <span className="text-[11px] text-muted-foreground">{dirs.map((d) => d.label).join(" · ")}</span> : null}
      </div>
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
