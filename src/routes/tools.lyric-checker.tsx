import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ToolLayout } from "@/components/tools/ToolLayout";
import { Textarea } from "@/components/ui/textarea";
import { APP_NAME } from "@/lib/brand";
import { checkLyrics } from "@/lib/lyric-check";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tools/lyric-checker")({
  head: () => ({
    meta: [
      { title: `Free Suno Lyric Checker: clichés, pronunciation, line length | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Paste your lyrics to find AI clichés, words Suno tends to sing wrong, overused words and lines too long or short for their section. Free, no account, nothing uploaded.",
      },
    ],
  }),
  component: LyricChecker,
});

const SAMPLE = `[Verse 1]
Neon lights in the city tonight
I'm lost in the shadows, searching for the light
Grey rain on the window at 3 AM
Counting every car that won't come back again and again and again

[Chorus]
Hold on, hold on
Don't let the silence win
Hold on, hold on`;

function LyricChecker() {
  const [text, setText] = useState("");
  const report = useMemo(() => checkLyrics(text), [text]);
  const has = text.trim().length > 0;

  return (
    <ToolLayout
      title="Suno Lyric Checker"
      lede="Paste your lyrics. It flags worn-out AI phrases, words Suno tends to sing wrong, overused words, and lines much longer or shorter than the rest of their section. Checked in your browser; nothing is sent anywhere."
      cta={{
        text: "Want the flagged lines rewritten, or lyrics written hook-first with these checks built in? Lyric Forge does that in the studio.",
        href: "/studio?tab=lyrics",
        label: "Open Lyric Forge",
      }}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            aria-label="Your lyrics"
            placeholder="Paste lyrics here, with [Verse], [Chorus] tags if you have them."
            className="font-mono text-sm"
          />
          {!has ? (
            <button type="button" onClick={() => setText(SAMPLE)} className="text-sm text-primary underline">
              Try an example
            </button>
          ) : null}
        </div>

        <div>
          {!has ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Results show here as you type.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Clichés", report.clicheCount],
                  ["Pronunciation", report.pronunciationCount],
                  ["Odd lengths", report.outlierCount],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className={cn("text-2xl font-bold", n ? "text-amber-400" : "text-emerald-400")}>{n}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {report.overused.length ? (
                <p className="text-sm">
                  <span className="font-medium">Overused:</span>{" "}
                  {report.overused.map((o) => `"${o.word}" ×${o.count}`).join(", ")}
                </p>
              ) : null}
              <ol className="space-y-1.5">
                {report.lines.map((l, i) => {
                  if (l.text.trim() === "") return <li key={i} className="h-2" aria-hidden="true" />;
                  if (l.isTag)
                    return (
                      <li key={i} className="pt-2 font-mono text-xs text-primary">
                        {l.text.trim()}
                      </li>
                    );
                  const flagged = l.cliches.length || l.pronunciation.length || l.lengthOutlier;
                  return (
                    <li key={i} className={cn("rounded-md border px-3 py-2 text-sm", flagged ? "border-amber-500/40 bg-amber-500/5" : "border-border")}>
                      <div className="flex justify-between gap-3">
                        <span>{l.text}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{l.syllables} syl</span>
                      </div>
                      {l.cliches.length ? (
                        <p className="mt-1 text-xs text-amber-300">Cliché: {l.cliches.map((c) => `"${c}"`).join(", ")}</p>
                      ) : null}
                      {l.pronunciation.map((p, k) => (
                        <p key={k} className="mt-1 text-xs text-amber-300">
                          "{p.word}": {p.why} Try: {p.suggestion}
                        </p>
                      ))}
                      {l.lengthOutlier ? (
                        <p className="mt-1 text-xs text-amber-300">Much longer or shorter than the other lines here; Suno may rush or stretch it.</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
