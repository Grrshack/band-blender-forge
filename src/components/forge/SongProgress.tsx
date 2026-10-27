import { ArrowRight, Check } from "lucide-react";

import type { ForgeState } from "./types";
import { nextStep, readinessPct, songSteps } from "@/lib/song-status";

/** Asks the studio to open a tool (the studio listens for this event). */
export function openStudioTab(tab: string) {
  window.dispatchEvent(new CustomEvent("bb:open-tab", { detail: tab }));
}

/** One compact chip: how ready the song is and what's next. Opens the song page. */
export function SongProgress({ state }: { state: ForgeState }) {
  const steps = songSteps(state);
  const pct = readinessPct(steps);
  const next = nextStep(steps);
  return (
    <button
      type="button"
      onClick={() => openStudioTab("song")}
      title="Open this song's page"
      className="flex max-w-full items-center gap-2 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <span className="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-card" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 font-medium text-foreground">{pct}% ready</span>
      {next ? (
        <span className="hidden min-w-0 items-center gap-1 truncate md:flex">
          <ArrowRight className="size-3 shrink-0" /> Next: {next.label}
        </span>
      ) : (
        <Check className="size-3 text-signal-high" />
      )}
    </button>
  );
}
