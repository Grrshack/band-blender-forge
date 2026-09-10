import type { ReactNode } from "react";

import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel-surface p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-foreground uppercase">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ReadoutField({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/70 p-3",
        accent ? "border-accent/40 glow-teal" : "border-border",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {label}
        </span>
        <CopyButton value={value} size="icon" />
      </div>
      <p
        className={cn(
          "text-sm leading-relaxed break-words whitespace-pre-wrap",
          mono ? "font-mono text-accent" : "text-card-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
