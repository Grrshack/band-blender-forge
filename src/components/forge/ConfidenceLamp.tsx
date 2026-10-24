import { cn } from "@/lib/utils";

/** The coloured confidence light at the top of a blend result. */
export function ConfidenceLamp({ level, note }: { level: string; note: string }) {
  const tone =
    level === "high"
      ? "text-signal-high border-signal-high/50 bg-signal-high/10"
      : level === "medium"
        ? "text-signal-mid border-signal-mid/50 bg-signal-mid/10"
        : "text-signal-low border-signal-low/50 bg-signal-low/10";
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", tone)}>
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-current" />
      </span>
      <div className="text-xs">
        <span className="font-mono tracking-[0.18em] uppercase">Confidence: {level}</span>
        <span className="ml-2 text-muted-foreground">{note}</span>
      </div>
    </div>
  );
}
