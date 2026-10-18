import { Check } from "lucide-react";

import type { ForgeState } from "./types";
import { cn } from "@/lib/utils";

/** Where this song is: one glance at which stages have been done. */
export function songStages(state: ForgeState) {
  const kept = state.takes.some((t) => t.rating >= 5);
  return [
    { label: "Sound", done: Boolean(state.blend.result?.styleTag?.trim()) },
    { label: "Lyrics", done: state.lyrics.sections.some((s) => s.lines.length > 0) },
    {
      label: state.takes.length ? `Takes ${state.takes.length}` : "Takes",
      done: state.takes.length > 0,
    },
    { label: "Keeper", done: kept },
    ...(state.takes.some((t) => t.downloaded)
      ? [{ label: `Downloads ${state.takes.filter((t) => t.downloaded).length}`, done: true }]
      : []),
    { label: "Release", done: state.dossiers.length > 0 },
  ];
}

export function SongProgress({ state }: { state: ForgeState }) {
  const stages = songStages(state);
  return (
    <ol aria-label="Song progress" className="flex flex-wrap items-center gap-1">
      {stages.map((s) => (
        <li
          key={s.label}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
            s.done
              ? "border-signal-high/40 bg-signal-high/10 text-signal-high"
              : "border-border text-muted-foreground",
          )}
        >
          {s.done ? <Check className="size-3" /> : null}
          {s.label}
        </li>
      ))}
    </ol>
  );
}
