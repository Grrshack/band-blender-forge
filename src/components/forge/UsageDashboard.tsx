import { useServerFn } from "@tanstack/react-start";
import { BarChart2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { Panel } from "./Field";
import { getMyUsage, type UsageDay, type UsageSummary } from "@/lib/community.functions";
import { cn } from "@/lib/utils";

const TASK_LABELS: Record<string, string> = {
  blend: "Blend",
  song: "Song lookup",
  lyrics: "Lyrics",
  regenLine: "Regen line",
  regenSection: "Regen section",
  compare: "Comparables",
  critique: "Feedback",
  fixTake: "Fix a Take",
  variants: "Variants",
};

const TASK_COLORS: Record<string, string> = {
  blend: "bg-primary",
  lyrics: "bg-accent",
  song: "bg-blue-500",
  compare: "bg-emerald-500",
  critique: "bg-orange-500",
  fixTake: "bg-rose-500",
  variants: "bg-violet-500",
  regenLine: "bg-yellow-500",
  regenSection: "bg-teal-500",
};

export function UsageDashboard() {
  const { session } = useAuth();
  const load = useServerFn(getMyUsage);

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<UsageDay[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    void (async () => {
      try {
        const result = await load();
        setDays(result.days);
        setSummary(result.summary);
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  if (!session) {
    return (
      <Panel title="Usage" subtitle="Sign in to see your usage.">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sign in to see your call history.
        </p>
      </Panel>
    );
  }

  // Build a day-by-day summary for the last 14 days
  const today = new Date();
  const allDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  // Total calls per day (all tasks)
  const callsByDay = new Map<string, number>();
  for (const row of days) {
    callsByDay.set(row.day, (callsByDay.get(row.day) ?? 0) + row.calls);
  }
  const maxCalls = Math.max(...Array.from(callsByDay.values()), 1);

  // Total calls per task (all time in window)
  const callsByTask = new Map<string, number>();
  for (const row of days) {
    callsByTask.set(row.task, (callsByTask.get(row.task) ?? 0) + row.calls);
  }
  const taskEntries = Array.from(callsByTask.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <Panel title="Usage" subtitle="Your AI call history over the last 14 days.">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Last 24h", value: summary?.calls_24h ?? 0 },
                { label: "Last 7 days", value: summary?.calls_7d ?? 0 },
                { label: "Last 14 days", value: summary?.total_calls ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card/50 p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bar chart — calls per day */}
            <div className="mt-6">
              <div className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Calls per day
              </div>
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {allDays.map((day) => {
                  const count = callsByDay.get(day) ?? 0;
                  const height = count === 0 ? 4 : Math.max(8, (count / maxCalls) * 72);
                  const isToday = day === today.toISOString().slice(0, 10);
                  return (
                    <div key={day} className="group relative flex flex-1 flex-col items-center justify-end">
                      <div
                        className={cn(
                          "w-full rounded-sm transition-colors",
                          count > 0 ? "bg-primary/60 group-hover:bg-primary" : "bg-border/50",
                          isToday && "ring-1 ring-primary/50",
                        )}
                        style={{ height }}
                      />
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] opacity-0 group-hover:opacity-100">
                        {count} call{count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>{allDays[0]?.slice(5)}</span>
                <span>today</span>
              </div>
            </div>

            {/* Task breakdown */}
            {taskEntries.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  By feature
                </div>
                <div className="space-y-1.5">
                  {taskEntries.map(([task, count]) => {
                    const total = summary?.total_calls ?? 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={task} className="flex items-center gap-2">
                        <div className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">
                          {TASK_LABELS[task] ?? task}
                        </div>
                        <div className="flex-1 overflow-hidden rounded-full bg-border/50" style={{ height: 6 }}>
                          <div
                            className={cn("h-full rounded-full", TASK_COLORS[task] ?? "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-8 text-right font-mono text-[10px] text-muted-foreground">
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {taskEntries.length === 0 && !loading && (
              <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                <BarChart2 className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No calls yet in the last 14 days.</p>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
