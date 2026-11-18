/**
 * Starter steps: a slim progress bar at the top of the studio that opens into a five-step
 * checklist. Each tool ticks its own step (see markStep in src/lib/starter-steps.ts).
 */
import { Check, ChevronDown, ChevronUp, PartyPopper, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  STARTER_EVENT,
  STARTER_KEY,
  STARTER_STEPS,
  loadSteps,
  nextStep,
  progressOf,
  setStepsHidden,
  type StarterSaved,
  type StarterStep,
} from "@/lib/starter-steps";
import { cn } from "@/lib/utils";

/** Keeps the saved steps in sync with this tab and others. Empty on the server and first paint. */
export function useStarterSteps(): StarterSaved | null {
  const [saved, setSaved] = useState<StarterSaved | null>(null);
  useEffect(() => {
    const read = () => setSaved(loadSteps());
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STARTER_KEY) read();
    };
    window.addEventListener(STARTER_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STARTER_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return saved;
}

const studioTab = (href: string): string | null => {
  const m = /^\/studio\?tab=([a-z]+)/.exec(href);
  return m ? m[1]! : null;
};

export function StarterSteps({ onOpenTab, className }: { onOpenTab?: (tab: string) => void; className?: string }) {
  const saved = useStarterSteps();
  const [open, setOpen] = useState(false);
  if (!saved || saved.hidden) return null;
  const p = progressOf(saved);
  const next = nextStep(saved);

  const go = (step: StarterStep) => {
    const tab = studioTab(step.href);
    if (tab && onOpenTab) {
      onOpenTab(tab);
      setOpen(false);
    } else window.location.href = step.href;
  };

  return (
    <section aria-label="Starter steps" className={cn("mb-4 rounded-xl border border-border bg-card/50 p-3", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="shrink-0 text-sm font-medium">
            {p.complete ? "Starter steps done" : "Starter steps"}{" "}
            <span className="text-muted-foreground" data-testid="starter-count">
              {p.done}/{p.total}
            </span>
          </span>
          <span
            className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Starter steps done"
            aria-valuemin={0}
            aria-valuemax={p.total}
            aria-valuenow={p.done}
          >
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${p.pct}%` }} />
          </span>
          {next ? <span className="hidden truncate text-xs text-muted-foreground sm:inline">Next: {next.title}</span> : null}
          {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
        </button>
        <button
          type="button"
          onClick={() => setStepsHidden(true)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Hide starter steps"
          title="Hide starter steps"
        >
          <X className="size-4" />
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          {p.complete ? (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <PartyPopper className="size-4 text-emerald-400" /> All five done. You've seen everything Band Blender does from idea to
              artist. You can hide this now.
            </p>
          ) : null}
          <ol className="space-y-2">
            {STARTER_STEPS.map((s, i) => {
              const done = Boolean(saved.done[s.id]);
              return (
                <li key={s.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>
                      {s.title}
                      <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{s.body}</p>
                  </div>
                  {!done ? (
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => go(s)}>
                      {s.cta}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
