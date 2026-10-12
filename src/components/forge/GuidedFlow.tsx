/**
 * GuidedFlow — 4-step wizard mode. Reuses the same tab components as the Rack
 * Console but walks the user through them one at a time with a progress bar and
 * Back / Continue navigation. No new logic: it's purely a layout wrapper.
 */
import { useState } from "react";
import {
  AudioWaveform,
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Map,
  Rocket,
  Search,
  Stethoscope,
} from "lucide-react";

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

/** Rack-only tools surfaced in the completion panel on the final guided step. */
const RACK_TOOLS = [
  { tab: "fix",     label: "Fix a Take",      icon: Stethoscope,  desc: "Diagnose what went wrong and try again" },
  { tab: "master",  label: "Mastering",       icon: AudioWaveform, desc: "EQ & dynamics suggestions for your mix" },
  { tab: "dossier", label: "Release Dossier", icon: Rocket,        desc: "Cover art, metadata, pitch copy & social hooks" },
  { tab: "compare", label: "Comparables",     icon: Search,        desc: "Find artists you sound like" },
  { tab: "genres",  label: "Genre Guides",    icon: Map,           desc: "Reference guides for any genre" },
  { tab: "library", label: "Prompt Library",  icon: BookMarked,    desc: "Save and reuse style prompts" },
] as const;

type Props = {
  state: ForgeState;
  patch: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
  onExitToRack: () => void;
  /** Jump straight to a specific rack tab */
  onExitToTab?: (tab: string) => void;
  /** Jump straight to Fix a Take in rack mode (convenience alias kept for callers) */
  onExitToFixTake?: () => void;
  autoRun?: boolean | undefined;
  onAutoRunDone?: (() => void) | undefined;
};

export function GuidedFlow({ state, patch, onExitToRack, onExitToTab, onExitToFixTake, autoRun, onAutoRunDone }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  // The studio assistant always lands on the blend step.
  useEffect(() => {
    if (autoRun) setStepIdx(0);
  }, [autoRun]);
  // stepIdx is always in [0, STEPS.length-1]; the non-null assertion is safe.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const step = STEPS[stepIdx]!;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  const exitToTab = (tab: string) => {
    if (onExitToTab) {
      onExitToTab(tab);
    } else {
      onExitToRack();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Step Progress Bar ── panel-neon gives it the neon top-edge treatment */}
      <div className="panel-neon rounded-xl border border-border bg-panel/60 px-6 py-4">
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
                      <div className="size-5 rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_10px_var(--color-primary)] transition-all" />
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
            autoRun={autoRun}
            onAutoRunDone={onAutoRunDone}
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

      {/* ── Completion panel — shown only on the last step ── */}
      {isLast && (
        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <p className="mb-3 font-mono text-[10px] tracking-wider text-primary uppercase">
            What's next — full rack tools
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RACK_TOOLS.map((tool) => (
              <button
                key={tool.tab}
                type="button"
                onClick={() => exitToTab(tool.tab)}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <tool.icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <div className="font-mono text-[10px] tracking-wider text-foreground uppercase">
                    {tool.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation row ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={isFirst}
          onClick={() => setStepIdx((i) => i - 1)}
          className="gap-1.5 font-mono text-[11px]"
        >
          <ChevronLeft className="size-3.5" /> Back
        </Button>

        {!isLast ? (
          <Button
            size="sm"
            onClick={() => setStepIdx((i) => i + 1)}
            className="glow-pulse gap-1.5 font-mono text-[11px]"
          >
            Continue <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {onExitToFixTake ? (
              <Button
                size="sm"
                onClick={onExitToFixTake}
                className="glow-pulse gap-1.5 font-mono text-[11px]"
              >
                Fix this take <ChevronRight className="size-3.5" />
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={onExitToRack}
              className="gap-1.5 font-mono text-[11px] border-border text-muted-foreground hover:text-foreground"
            >
              Full rack →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
