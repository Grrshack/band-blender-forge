/**
 * GuidedFlow — 4-step wizard mode. Reuses the same tab components as the Rack
 * Console but walks the user through them one at a time with a progress bar and
 * Back / Continue navigation. No new logic: it's purely a layout wrapper.
 */
import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle } from "lucide-react";

import { BandBlender } from "./BandBlender";
import { HonestFeedback } from "./HonestFeedback";
import { LyricForge } from "./LyricForge";
import { SunoSheet } from "./SunoSheet";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";

const STEPS = [
  { key: "blend",    label: "Sound Concept",  subtitle: "Set your artist blend & target genre" },
  { key: "lyrics",   label: "Lyrics & Hook",  subtitle: "Build your song structure" },
  { key: "suno",     label: "Engine Export",  subtitle: "Format your prompt for any engine" },
  { key: "feedback", label: "Polish",          subtitle: "Evaluate and sharpen your track" },
] as const;

type StepKey = typeof STEPS[number]["key"];

type Props = {
  state: ForgeState;
  patch: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
  onExitToRack: () => void;
};

export function GuidedFlow({ state, patch, onExitToRack }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="space-y-6">
      {/* ── Step Progress Bar ── */}
      <div className="rounded-xl border border-border bg-panel/60 px-6 py-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStepIdx(i)}
                className="group flex flex-1 flex-col items-center gap-1.5 px-2"
              >
                <div className="flex items-center w-full">
                  {/* connector line before */}
                  {i > 0 && (
                    <div
                      className={`flex-1 h-px transition-colors ${
                        done || active ? "bg-primary/60" : "bg-border"
                      }`}
                    />
                  )}
                  {/* step dot */}
                  <div className="relative shrink-0">
                    {done ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : active ? (
                      <div className="size-5 rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_8px_var(--primary)] transition-all" />
                    ) : (
                      <Circle className="size-5 text-border group-hover:text-muted-foreground transition-colors" />
                    )}
                  </div>
                  {/* connector line after */}
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px transition-colors ${done ? "bg-primary/60" : "bg-border"}`}
                    />
                  )}
                </div>
                <span
                  className={`font-mono text-[10px] tracking-wider uppercase transition-colors ${
                    active
                      ? "text-primary"
                      : done
                        ? "text-muted-foreground"
                        : "text-border group-hover:text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
          Step {stepIdx + 1} of {STEPS.length} · {step.subtitle}
        </p>
      </div>

      {/* ── Active Step Component ── */}
      <div>
        {step.key === "blend" && (
          <BandBlender
            value={state.blend}
            onChange={(v) => patch("blend", v)}
            onSendToForge={() => setStepIdx(1)}
            onOpenSunoSheet={() => setStepIdx(2)}
          />
        )}
        {step.key === "lyrics" && (
          <LyricForge
            value={state.lyrics}
            onChange={(v) => patch("lyrics", v)}
            blend={state.blend.result}
          />
        )}
        {step.key === "suno" && (
          <SunoSheet
            blend={state.blend}
            lyrics={state.lyrics}
            onBlend={(v) => patch("blend", v)}
            onLyrics={(v) => patch("lyrics", v)}
            onOpenForge={() => setStepIdx(1)}
          />
        )}
        {step.key === "feedback" && (
          <HonestFeedback
            value={state.critique}
            onChange={(v) => patch("critique", v)}
            lyrics={state.lyrics}
          />
        )}
      </div>

      {/* ── Navigation row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFirst}
            onClick={() => setStepIdx((i) => i - 1)}
            className="gap-1.5 font-mono text-[11px]"
          >
            <ChevronLeft className="size-3.5" /> Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitToRack}
            className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase"
          >
            Open full rack
          </Button>
        </div>

        {!isLast ? (
          <Button
            size="sm"
            onClick={() => setStepIdx((i) => i + 1)}
            className="gap-1.5 font-mono text-[11px]"
          >
            Continue <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onExitToRack}
            className="gap-1.5 font-mono text-[11px] border-primary/40 text-primary hover:bg-primary/10"
          >
            Open full rack →
          </Button>
        )}
      </div>
    </div>
  );
}
