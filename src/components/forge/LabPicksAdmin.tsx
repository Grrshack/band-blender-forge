import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, FlaskConical, Loader2, RotateCw, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BriefReadout } from "./BriefReadout";
import { ErrorNote, FoldSummary, Panel } from "./Field";
import type { BlendResult } from "./types";
import { emptyState } from "./types";
import { useForge } from "./use-forge";
import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  draftFromBlend,
  dropLabel,
  genreTags,
  loadDrafts,
  newDraft,
  nextDrop,
  pairKey,
  pickSeeds,
  saveDrafts,
  swapDraftFormat,
  type LabDraft,
} from "@/lib/lab";
import { PROMPT_FORMAT_LABELS, briefMatches, type PromptFormat } from "@/lib/prompt-craft";
import { deleteLabPick, listAdminLabPicks, publishLabPicks, type LabPick } from "@/lib/lab.functions";
import { cn } from "@/lib/utils";

type DropChoice = "monday" | "friday" | "now" | "custom";

/** Messages that mean the key's daily allowance is used up, so the rest of the batch would fail too. */
const looksLikeDailyLimit = (m: string) => /per day|daily|quota|resource has been exhausted|RESOURCE_EXHAUSTED/i.test(m);

/** Admin only: generate a batch of blends, review them, then schedule them as a drop. */
export function LabPicksAdmin() {
  const forge = useForge();
  const { apiKey } = useSettings();
  const loadAdmin = useServerFn(listAdminLabPicks);
  const publish = useServerFn(publishLabPicks);
  const remove = useServerFn(deleteLabPick);

  const [drafts, setDrafts] = useState<LabDraft[]>([]);
  const [count, setCount] = useState(5);
  const [lean, setLean] = useState("");
  const [format, setFormat] = useState<PromptFormat>("brief");
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const [drop, setDrop] = useState<DropChoice>("monday");
  const [custom, setCustom] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [scheduled, setScheduled] = useState<LabPick[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (fn: (d: LabDraft[]) => LabDraft[]) =>
    setDrafts((prev) => {
      const next = fn(prev);
      saveDrafts(next);
      return next;
    });

  const refresh = async () => {
    try {
      setScheduled(await loadAdmin());
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Couldn't load your Lab Picks.");
    }
  };

  const runOne = async (d: LabDraft): Promise<LabDraft> => {
    const base = emptyState().blend;
    const res = await forge({
      data: {
        task: "blend",
        routing: "fast",
        apiKey,
        payload: {
          artists: d.artists,
          sliders: base.sliders,
          sunoVersion: "v6",
          targetGenre: lean.trim(),
          genreLock: false,
          targetEra: "",
          promptFormat: d.styleFormat,
        },
      },
    });
    return draftFromBlend(d, JSON.parse(res.json) as BlendResult, d.styleFormat);
  };

  const generate = async () => {
    setNotice(null);
    const avoid = new Set([...scheduled.map((p) => pairKey(p.artists)), ...drafts.map((d) => pairKey(d.artists))]);
    const fresh = pickSeeds(count, avoid).map((pair) => newDraft(pair, format));
    commit((prev) => [...fresh, ...prev]);
    setRunning(true);
    stopRef.current = false;
    for (const d of fresh) {
      if (stopRef.current) break;
      commit((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "making" } : x)));
      try {
        const done = await runOne(d);
        commit((prev) => prev.map((x) => (x.id === d.id ? done : x)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Blend failed.";
        commit((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "failed", error: msg } : x)));
        if (looksLikeDailyLimit(msg)) {
          setNotice("Your AI key looks out of free requests for today. The rest are left waiting; press Redo on them tomorrow.");
          break;
        }
      }
    }
    setRunning(false);
  };

  const redo = async (d: LabDraft) => {
    commit((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "making", error: undefined } : x)));
    try {
      const done = await runOne(d);
      commit((prev) => prev.map((x) => (x.id === d.id ? done : x)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Blend failed.";
      commit((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "failed", error: msg } : x)));
    }
  };

  const edit = (id: string, patch: Partial<LabDraft>) => commit((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const dropAt = (): Date | null => {
    if (drop === "monday") return nextDrop(1);
    if (drop === "friday") return nextDrop(5);
    if (drop === "now") return new Date();
    const d = new Date(custom);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const ready = drafts.filter((d) => d.status === "ready" && d.title.trim().length >= 3 && d.styleTag.trim().length >= 5);

  const send = async () => {
    const when = dropAt();
    if (!when) {
      toast.error("Pick a date and time for the drop.");
      return;
    }
    setPublishing(true);
    try {
      await publish({
        data: {
          dropAt: when.toISOString(),
          picks: ready.slice(0, 10).map((d) => ({
            title: d.title.trim().slice(0, 80),
            style_tag: d.styleTag.trim().slice(0, 1000),
            ...(d.excludeStyles.trim() ? { exclude_styles: d.excludeStyles.trim().slice(0, 1000) } : {}),
            ...(d.vocalPrompt ? { vocal_prompt: d.vocalPrompt } : {}),
            artists: d.artists,
            genre_tags: genreTags(d.genre),
          })),
        },
      });
      const sent = new Set(ready.slice(0, 10).map((d) => d.id));
      commit((prev) => prev.filter((d) => !sent.has(d.id)));
      toast.success(drop === "now" ? "Lab Picks are live." : `Scheduled for ${dropLabel(when.toISOString())}.`);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the picks.");
    } finally {
      setPublishing(false);
    }
  };

  const unschedule = async (id: string) => {
    try {
      await remove({ data: { id } });
      setScheduled((s) => s.filter((p) => p.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that pick.");
    }
  };

  const now = new Date();
  const groups = scheduled.reduce<Record<string, LabPick[]>>((m, p) => {
    const k = p.drop_at ?? "";
    (m[k] ??= []).push(p);
    return m;
  }, {});

  return (
    <Panel
      title="Lab Picks"
      subtitle="Generate fresh blends with your own key, keep the good ones, and schedule them. They appear in the Prompt Library at the drop time. Nobody else can see this."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium">How many</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="block text-xs font-medium">Write them as</span>
            <div role="radiogroup" aria-label="Pick format" className="inline-flex h-9 rounded-md border border-border p-0.5">
              {(["brief", "tags"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={format === f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded px-2.5 text-xs transition-colors",
                    format === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PROMPT_FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <label className="min-w-48 flex-1 space-y-1">
            <span className="block text-xs font-medium">Lean toward a genre (optional)</span>
            <Input value={lean} onChange={(e) => setLean(e.target.value)} placeholder="e.g. darkwave, or leave empty" maxLength={40} />
          </label>
          {running ? (
            <Button variant="outline" onClick={() => (stopRef.current = true)} className="gap-1.5">
              <Square className="size-3.5" /> Stop after this one
            </Button>
          ) : (
            <Button onClick={() => void generate()} className="glow-primary gap-1.5">
              <FlaskConical className="size-4" /> Generate picks
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          One AI call per pick, made from this browser with your key. Every pick gets both versions: the Studio Brief in its six
          parts (Sound, Pulse, Players, Voice, Arc, Finish) and the tag list; the one you choose is what gets published. Pairs come
          from different lanes and skip anything you&apos;ve already dropped.
        </p>
        {notice ? <ErrorNote message={notice} /> : null}

        {drafts.length ? (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{d.artists.join(" × ")}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      d.status === "ready" && "bg-signal-high/15 text-signal-high",
                      d.status === "making" && "bg-primary/15 text-primary",
                      d.status === "failed" && "bg-destructive/15 text-destructive",
                      d.status === "waiting" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {d.status === "making" ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> making
                      </span>
                    ) : (
                      d.status
                    )}
                  </span>
                  {d.genre ? <span className="text-[11px] text-muted-foreground">{d.genre}</span> : null}
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={d.status === "making" || running} onClick={() => void redo(d)}>
                      <RotateCw className="size-3" /> Redo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      aria-label={`Remove ${d.title}`}
                      disabled={d.status === "making"}
                      onClick={() => commit((prev) => prev.filter((x) => x.id !== d.id))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </div>
                {d.error ? <p className="mt-1 text-xs text-destructive">{d.error}</p> : null}
                {d.status === "ready" ? (
                  <div className="mt-2 space-y-2">
                    <Input value={d.title} onChange={(e) => edit(d.id, { title: e.target.value })} maxLength={80} aria-label="Pick title" />
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        Publishing the <span className="text-foreground">{PROMPT_FORMAT_LABELS[d.styleFormat].toLowerCase()}</span> ·{" "}
                        {d.styleTag.length} / 1,000
                      </span>
                      {d.styleAlt ? (
                        <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => edit(d.id, swapDraftFormat(d))}>
                          Use the {PROMPT_FORMAT_LABELS[d.styleFormat === "brief" ? "tags" : "brief"].toLowerCase()} instead
                        </button>
                      ) : null}
                    </div>
                    {d.styleFormat === "brief" && briefMatches(d.briefParts, d.styleTag) ? (
                      <BriefReadout parts={d.briefParts} text={d.styleTag} />
                    ) : null}
                    <details className="group rounded-lg border border-border" open={!(d.styleFormat === "brief" && briefMatches(d.briefParts, d.styleTag))}>
                      <FoldSummary className="py-2 text-xs">Edit the text</FoldSummary>
                      <div className="px-3 pb-3">
                        <Textarea
                          value={d.styleTag}
                          onChange={(e) => edit(d.id, { styleTag: e.target.value })}
                          rows={d.styleFormat === "brief" ? 6 : 3}
                          maxLength={1000}
                          className="font-mono text-xs"
                          aria-label="Style"
                        />
                      </div>
                    </details>
                    <Input
                      value={d.excludeStyles}
                      onChange={(e) => edit(d.id, { excludeStyles: e.target.value })}
                      maxLength={1000}
                      className="text-xs"
                      aria-label="Exclude styles"
                      placeholder="Exclude styles"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {ready.length ? (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
            <label className="space-y-1">
              <span className="block text-xs font-medium">Drop</span>
              <select
                value={drop}
                onChange={(e) => setDrop(e.target.value as DropChoice)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="monday">Next Monday, 9:00</option>
                <option value="friday">Next Friday, 9:00</option>
                <option value="now">Now</option>
                <option value="custom">Pick a time…</option>
              </select>
            </label>
            {drop === "custom" ? (
              <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-auto" aria-label="Drop time" />
            ) : null}
            <Button onClick={() => void send()} disabled={publishing || running} className="gap-1.5">
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Schedule {Math.min(ready.length, 10)} pick{ready.length === 1 ? "" : "s"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {dropAt() ? `Goes live ${dropAt()!.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, your time.` : ""}
            </span>
          </div>
        ) : null}

        <details className="group rounded-lg border border-border">
          <FoldSummary icon={<CalendarClock className="size-4 shrink-0 text-primary" />} hint="Scheduled and past drops. Delete one to take it down.">
            Your drops ({scheduled.length})
          </FoldSummary>
          <div className="space-y-3 px-3 pb-3">
            {listError ? <ErrorNote message={listError} onRetry={() => void refresh()} /> : null}
            {!listError && !scheduled.length ? <p className="text-xs text-muted-foreground">Nothing scheduled yet.</p> : null}
            {Object.entries(groups).map(([when, list]) => (
              <div key={when}>
                <p className="mb-1 text-xs font-medium">
                  {dropLabel(when)}{" "}
                  <span className={cn("ml-1 text-[10px]", new Date(when) > now ? "text-primary" : "text-signal-high")}>
                    {new Date(when) > now ? "scheduled" : "live"}
                  </span>
                </p>
                <ul className="space-y-1">
                  {list.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">▲ {p.upvotes}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" aria-label={`Delete ${p.title}`} onClick={() => void unschedule(p.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Panel>
  );
}
