import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

import type { MbInfo } from "./types";
import { cn } from "@/lib/utils";

/**
 * MusicBrainz check for one artist. "Couldn't check" (lookup failed) is shown
 * differently from "not found" — only the latter says anything about the artist.
 */
export function MbBadge({ info, showName }: { info: MbInfo; showName?: boolean }) {
  const name = showName ? <span className="font-medium text-foreground">{info.name}</span> : null;

  if (info.status === "found") {
    const renamed =
      info.matchedName && info.matchedName.toLowerCase() !== info.name.trim().toLowerCase();
    return (
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
          "border-signal-high/40 bg-signal-high/10 text-signal-high",
        )}
        title="Confirmed in MusicBrainz, an open music database"
      >
        <CheckCircle2 className="size-3.5 shrink-0" />
        {name}
        {renamed ? <span className="text-muted-foreground">as {info.matchedName}</span> : null}
        {info.tags.length ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {info.tags.slice(0, 4).join(" · ")}
          </span>
        ) : null}
      </span>
    );
  }

  if (info.status === "not_found") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-signal-mid/50 bg-signal-mid/10 px-2.5 py-1 text-[11px] text-signal-mid"
        title="No matching artist in MusicBrainz"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        {name}
        <span>Not found in MusicBrainz — check the spelling; it may not exist</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground"
      title="The lookup service didn't answer; this says nothing about the artist"
    >
      <HelpCircle className="size-3.5 shrink-0" />
      {name}
      <span>Couldn't check right now</span>
    </span>
  );
}
