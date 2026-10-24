/**
 * Small building blocks of the Mastering Lab: the labelled slider, the collapsible control
 * group, number formatting, and the optional BandLab finishing card. Kept separate so
 * MasteringLab.tsx holds only the screen's logic.
 */
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { GroupId } from "@/lib/audio/mastering-format";


export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "pointer-events-none opacity-40")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-xs text-accent">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled ?? false}
        onValueChange={(v) => onChange(v[0]!)}
        aria-label={label}
      />
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}


/**
 * A control group that starts closed. The closed header still shows the current settings
 * and a dot when the group is doing something, so nobody forgets it's there.
 */
export function Group({
  id,
  title,
  summary,
  active,
  open,
  onToggle,
  children,
  dim,
}: {
  id: GroupId;
  title: string;
  summary: string;
  active: boolean;
  open: boolean;
  onToggle: (id: GroupId) => void;
  children: ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      id={`master-group-${id}`}
      className={cn("rounded-lg border bg-card/50", open ? "border-primary/40" : "border-border", dim && "opacity-60")}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`master-group-body-${id}`}
        className="flex w-full items-start gap-2.5 p-3.5 text-left"
      >
        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {active ? (
              <span className="flex items-center gap-1 text-[10px] font-normal text-signal-high">
                <span className="size-1.5 rounded-full bg-signal-high" /> in use
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="shrink-0 text-xs text-primary">{open ? "Close" : "Adjust"}</span>
      </button>
      {open ? (
        <div id={`master-group-body-${id}`} className="space-y-3.5 border-t border-border/60 p-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Optional last step: BandLab is free and is where many people finish AI songs. */
export function BandLabFinish() {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <p className="text-sm font-semibold">Finishing in BandLab (optional)</p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          <span className="text-foreground/90">Rebalance stems:</span> BandLab's free online studio
          lets you raise a buried vocal or lower a loud instrument, which mastering can't do. Load
          your Suno stems, mix, then master the result here.
        </li>
        <li>
          <span className="text-foreground/90">Second opinion:</span> BandLab Mastering has 4 free
          presets (Universal, Fire, Clarity, Tape). Compare its result with yours.
        </li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a href="https://www.bandlab.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          BandLab
        </a>
        <a href="https://www.bandlab.com/mastering" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          BandLab Mastering
        </a>
      </div>
    </div>
  );
}
