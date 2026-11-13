import { createFileRoute } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, ArrowRight, Lightbulb, Undo2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CopyButton } from "@/components/forge/CopyButton";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APP_NAME } from "@/lib/brand";
import {
  CHECKER_IMPORT_KEY,
  FIX_LABELS,
  applyFix,
  checkPrompt,
  type CheckerBox,
  type CheckerFix,
  type CheckerInput,
  type CheckerIssue,
} from "@/lib/prompt-checker";
import { track } from "@/lib/stats";
import { SUNO_LIMITS, SUNO_VERSION_LABELS, type SunoVersion } from "@/lib/suno";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tools/suno-prompt-checker")({
  head: () => ({
    meta: [
      { title: `Free Suno Prompt Checker: score your style, exclude and lyrics | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Paste your Suno style prompt, exclude list and lyrics to get a score and one-click fixes: character limits, artist names Suno blocks, mixed signals, buried vocals, a clean ending. Free, no account, nothing uploaded.",
      },
    ],
  }),
  component: PromptChecker,
});

const EMPTY: CheckerInput = { title: "", style: "", exclude: "", lyrics: "", artists: [], version: "v6" };

/** An example with the usual mistakes in it, so the fixes have something to do. */
const SAMPLE: CheckerInput = {
  title: "Neon Rain",
  style:
    "synthwave, high quality, amazing, in the style of The Weeknd, slow, aggressive drums, soft whispery vocals, no autotune, retro 80s synths, cinematic",
  exclude: "",
  lyrics: `[Verse 1]
Neon lights in the city tonight
I'm lost in the shadows, searching for the light
Grey rain on the window at 3 AM

[Chorus]
Hold on, hold on
Don't let the silence win
Hold on, hold on

[Outro]
Hold on`,
  artists: [],
  version: "v6",
};

const LEVEL = {
  stop: { label: "Fix", icon: AlertOctagon, cls: "border-destructive/50 bg-destructive/5", text: "text-destructive" },
  warn: { label: "Check", icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/5", text: "text-amber-400" },
  tip: { label: "Tip", icon: Lightbulb, cls: "border-border bg-card/40", text: "text-sky-400" },
} as const;

const BOXES: CheckerBox[] = ["Style", "Exclude", "Lyrics", "Title"];

function scoreColor(score: number) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-lime-300";
  if (score >= 45) return "text-amber-400";
  return "text-destructive";
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className={cn("font-mono text-[11px]", n > max ? "text-destructive" : "text-muted-foreground")}>
      {n.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function PromptChecker() {
  const [input, setInput] = useState<CheckerInput>(EMPTY);
  const [history, setHistory] = useState<CheckerInput[]>([]);
  const [artistsText, setArtistsText] = useState("");
  const report = useMemo(() => checkPrompt(input), [input]);
  const set = (patch: Partial<CheckerInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const fix = (f: CheckerFix) => {
    setHistory((h) => [...h.slice(-9), input]);
    setInput((prev) => applyFix(prev, f));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setInput(last);
  };

  const openInStudio = () => {
    try {
      sessionStorage.setItem(
        CHECKER_IMPORT_KEY,
        JSON.stringify({ title: input.title, style: input.style, exclude: input.exclude, lyrics: input.lyrics, at: Date.now() }),
      );
    } catch {
      /* storage blocked: the studio just opens empty */
    }
    track("start_choice", "checker_to_studio");
    window.location.href = "/studio?tab=suno&import=checker";
  };

  const byBox = (box: CheckerBox) => report.issues.filter((i) => i.box === box);
  const has = input.style.trim().length > 0;
  const stops = report.issues.filter((i) => i.level === "stop").length;
  const warns = report.issues.filter((i) => i.level === "warn").length;

  return (
    <ToolLayout
      title="Suno Prompt Checker"
      lede="Paste your style prompt, exclude list and lyrics. You get a score and one-click fixes for what makes Suno ignore, refuse or bury parts of a prompt. Checked in your browser; nothing is sent anywhere."
      cta={{
        text: "Want a prompt that passes from the start, written from the artists or sound you have in mind, with lyrics to match? The studio does that, free on your own AI key.",
        href: "/studio",
        label: "Open the studio",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="pc-style" className="text-sm font-medium">
                Style of music
              </label>
              <Counter n={input.style.length} max={SUNO_LIMITS.style} />
            </div>
            <Textarea
              id="pc-style"
              value={input.style}
              onChange={(e) => set({ style: e.target.value })}
              rows={5}
              placeholder="dream pop, 90 BPM, shimmering synths, breathy female vocal…"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="pc-exclude" className="text-sm font-medium">
                Exclude styles <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Counter n={input.exclude.length} max={SUNO_LIMITS.exclude} />
            </div>
            <Input id="pc-exclude" value={input.exclude} onChange={(e) => set({ exclude: e.target.value })} placeholder="muddy mix, fade-out…" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="pc-lyrics" className="text-sm font-medium">
                Lyrics <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Counter n={input.lyrics.length} max={SUNO_LIMITS.lyrics} />
            </div>
            <Textarea
              id="pc-lyrics"
              value={input.lyrics}
              onChange={(e) => set({ lyrics: e.target.value })}
              rows={9}
              placeholder="[Verse 1]&#10;…"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="pc-title" className="text-sm font-medium">
                  Title <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Counter n={input.title.length} max={SUNO_LIMITS.title} />
              </div>
              <Input id="pc-title" value={input.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pc-version" className="text-sm font-medium">
                Suno version
              </label>
              <select
                id="pc-version"
                value={input.version}
                onChange={(e) => set({ version: e.target.value as SunoVersion })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(Object.keys(SUNO_VERSION_LABELS) as SunoVersion[]).map((v) => (
                  <option key={v} value={v}>
                    {SUNO_VERSION_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pc-artists" className="text-sm font-medium">
              Artists you had in mind <span className="font-normal text-muted-foreground">(optional, so their names are caught too)</span>
            </label>
            <Input
              id="pc-artists"
              value={artistsText}
              onChange={(e) => {
                setArtistsText(e.target.value);
                set({ artists: e.target.value.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 6) });
              }}
              placeholder="e.g. Portishead, Massive Attack"
            />
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => { setHistory([]); setArtistsText(""); setInput(SAMPLE); }} className="text-primary underline">
              Try an example
            </button>
            {has ? (
              <button type="button" onClick={() => { setHistory([]); setArtistsText(""); setInput(EMPTY); }} className="text-muted-foreground underline">
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div id="pc-results" className="scroll-mt-4 space-y-4 lg:sticky lg:top-4 lg:self-start">
          {!has || report.score === null ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Your score and fixes show here as you type.
            </p>
          ) : (
            <>
              <section aria-label="Score" className="flex items-center gap-5 rounded-xl border border-border bg-card/40 p-5">
                <p className={cn("font-display text-5xl font-bold tabular-nums", scoreColor(report.score))} data-testid="checker-score">
                  {report.score}
                </p>
                <div>
                  <p className="font-display text-lg font-semibold">{report.verdict}</p>
                  <p className="text-sm text-muted-foreground">
                    {stops ? `${stops} to fix` : "Nothing Suno will refuse"}
                    {warns ? ` · ${warns} to check` : ""}
                    {report.issues.length - stops - warns ? ` · ${report.issues.length - stops - warns} tip${report.issues.length - stops - warns === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                {history.length ? (
                  <Button variant="ghost" size="sm" onClick={undo} className="ml-auto gap-1 text-xs">
                    <Undo2 className="size-3.5" /> Undo fix
                  </Button>
                ) : null}
              </section>

              {BOXES.map((box) =>
                byBox(box).length ? (
                  <section key={box} aria-label={`${box} checks`} className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{box}</h2>
                    {byBox(box).map((i, n) => (
                      <IssueRow key={`${box}-${n}`} issue={i} onFix={fix} />
                    ))}
                  </section>
                ) : null,
              )}
              {!report.issues.length ? <p className="text-sm text-emerald-400">No problems found. Copy it into Suno.</p> : null}

              <section aria-label="Copy for Suno" className="rounded-xl border border-border bg-card/40 p-4">
                <p className="mb-2 text-sm font-medium">Copy the checked version into Suno</p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={input.style} label="Copy style" />
                  {input.exclude.trim() ? <CopyButton value={input.exclude} label="Copy exclude" /> : null}
                  {input.lyrics.trim() ? <CopyButton value={input.lyrics} label="Copy lyrics" /> : null}
                  {input.title.trim() ? <CopyButton value={input.title} label="Copy title" /> : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Open it on the Suno Sheet to send it with the extension, try darker or heavier takes, and log how each take turns out.
                  </p>
                  <Button size="sm" onClick={openInStudio} className="gap-1.5">
                    Open in the studio <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {has && report.score !== null ? (
        // Phones: the results sit below the boxes, so keep the score in reach while typing.
        <a
          href="#pc-results"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur lg:hidden"
        >
          <span className={cn("font-display text-lg font-bold tabular-nums", scoreColor(report.score))}>{report.score}</span>
          <span>See fixes ↓</span>
        </a>
      ) : null}

      <section className="mt-12 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <h2 className="mb-1 font-display text-base font-semibold text-foreground">What it checks</h2>
          <p>
            Suno's limits (1,000 characters of style, 1,000 of exclude, 5,000 of lyrics), artist names Suno blocks, mixed signals like slow
            and fast, more than one tempo, negatives in the style box, praise words that describe nothing, soft vocals that get buried, the
            genre coming too late, a missing clean ending, section tags, and worn-out lyric phrases.
          </p>
        </div>
        <div>
          <h2 className="mb-1 font-display text-base font-semibold text-foreground">How the score works</h2>
          <p>
            It starts at 100. Each red item costs 25, each amber one 8, each tip 3. A red item means Suno will refuse or cut part of the
            prompt; amber ones tend to give you a different song from the one you described.
          </p>
        </div>
      </section>
    </ToolLayout>
  );
}

function IssueRow({ issue, onFix }: { issue: CheckerIssue; onFix: (f: CheckerFix) => void }) {
  const l = LEVEL[issue.level];
  const Icon = l.icon;
  return (
    <div className={cn("flex flex-wrap items-start gap-x-2.5 gap-y-2 rounded-lg border px-3 py-2.5 text-sm", l.cls)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", l.text)} aria-hidden="true" />
      <p className="min-w-[14rem] flex-1">
        <span className={cn("mr-1.5 text-xs font-semibold uppercase", l.text)}>{l.label}</span>
        {issue.message}
      </p>
      {issue.fix ? (
        <Button size="sm" variant="secondary" onClick={() => onFix(issue.fix!)} className="ml-auto h-7 shrink-0 gap-1 px-2 text-xs">
          <Wand2 className="size-3" /> {FIX_LABELS[issue.fix]}
        </Button>
      ) : null}
    </div>
  );
}
