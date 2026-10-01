import { Timer } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAN_TEMPLATES, planSong, type PlanTemplate } from "@/lib/planner";

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${Math.round(s % 60)
    .toString()
    .padStart(2, "0")}`;

const LENGTHS = [
  ["90", "1:30"],
  ["120", "2:00"],
  ["150", "2:30"],
  ["180", "3:00"],
  ["210", "3:30"],
  ["240", "4:00"],
  ["300", "5:00"],
] as const;

/** Sizes sections to a target length and tempo, then feeds the plan to the lyric writer. */
export function LengthPlanner({
  structure,
  onStructure,
}: {
  structure: string;
  onStructure: (text: string) => void;
}) {
  const [seconds, setSeconds] = useState("180");
  const [bpm, setBpm] = useState("100");
  const [template, setTemplate] = useState<PlanTemplate>("pop");

  const bpmNum = Number(bpm);
  const valid = Number.isFinite(bpmNum) && bpmNum >= 50 && bpmNum <= 220;
  const plan = useMemo(
    () => (valid ? planSong({ seconds: Number(seconds), bpm: bpmNum, template }) : null),
    [seconds, bpmNum, template, valid],
  );

  const label = "font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase";

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Timer className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Length planner
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <span className={label}>Length</span>
          <Select value={seconds} onValueChange={setSeconds}>
            <SelectTrigger className="h-9 border-border bg-card/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTHS.map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className={label}>BPM</span>
          <Input
            value={bpm}
            inputMode="numeric"
            onChange={(e) => setBpm(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            aria-invalid={!valid}
            className="h-9 border-border bg-card/60 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <span className={label}>Style</span>
          <Select value={template} onValueChange={(v) => setTemplate(v as PlanTemplate)}>
            <SelectTrigger className="h-9 border-border bg-card/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_TEMPLATES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!valid ? (
        <p className="mt-2 text-[11px] text-destructive">BPM must be between 50 and 220.</p>
      ) : null}

      {plan ? (
        <>
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1 font-mono text-[10px] font-normal tracking-wider uppercase">
                  Section
                </th>
                <th className="pb-1 font-mono text-[10px] font-normal tracking-wider uppercase">
                  Bars
                </th>
                <th className="pb-1 font-mono text-[10px] font-normal tracking-wider uppercase">
                  Lines
                </th>
                <th className="pb-1 text-right font-mono text-[10px] font-normal tracking-wider uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.sections.map((s, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-1 font-mono text-accent">{s.tag}</td>
                  <td className="py-1">{s.bars}</td>
                  <td className="py-1 text-muted-foreground">
                    {s.instrumental ? "instrumental" : s.lines}
                  </td>
                  <td className="py-1 text-right font-mono text-muted-foreground">
                    {fmt(s.seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            ≈ {fmt(plan.totalSeconds)} · {plan.totalBars} bars at {bpmNum} BPM
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onStructure(plan.text)}
              className="h-8 text-xs"
            >
              Use this plan
            </Button>
            {structure ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onStructure("")}
                className="h-8 text-xs text-muted-foreground"
              >
                Clear plan
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {structure ? (
        <p className="mt-2 text-[11px] text-signal-high">
          Plan active — Forge Lyrics will follow it.
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        This steers the structure and line counts. Suno decides the actual length, so check the
        result and adjust.
      </p>
    </div>
  );
}
