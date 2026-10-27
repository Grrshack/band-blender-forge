import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { useEffect } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import type { AiLevel, ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import {
  AI_LEVELS,
  DISCLOSURE_QUESTIONS,
  MANUAL_CHECKS,
  autoChecks,
  disclosureAnswers,
  suggestDisclosure,
  type DisclosurePart,
} from "@/lib/release-check";
import { RELEASE_CHECKLIST } from "@/lib/release-checklist";
import { cn } from "@/lib/utils";

/** Lyrics as plain text for a distributor's lyrics field: no [section tags] or cues. */
function plainLyrics(state: ForgeState): string {
  return state.lyrics.sections
    .filter((s) => s.lines.length)
    .map((s) => s.lines.map((l) => l.text.trim()).join("\n"))
    .join("\n\n");
}

/** Before you upload: disclosure answers, the checks that get releases pulled, and a checklist. No distribution. */
export function ReleaseCheck({
  state,
  patch,
  onGoTab,
}: {
  state: ForgeState;
  patch: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
  onGoTab: (tab: string) => void;
}) {
  const release = state.release ?? {};
  const disclosure = release.disclosure ?? {};

  // Fill in the obvious answers once (music and vocals from Suno are AI); people can change them.
  useEffect(() => {
    if (state.release?.disclosure) return;
    patch("release", { ...state.release, disclosure: suggestDisclosure(state) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLevel = (part: DisclosurePart, level: AiLevel) =>
    patch("release", { ...release, disclosure: { ...disclosure, [part]: level } });
  const tick = (id: string, on: boolean) => patch("release", { ...release, ticks: { ...release.ticks, [id]: on } });

  const answers = disclosureAnswers(disclosure);
  const checks = autoChecks(state);
  const lyrics = plainLyrics(state);

  return (
    <div className="space-y-5">
      <Panel
        title="Release Check"
        subtitle="Band Blender doesn't upload your song anywhere. This gets it ready for your distributor: honest AI answers, and the problems that get releases pulled."
      >
        <h3 className="mb-1 text-sm font-semibold">1. How much AI went into it?</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Distributors and stores now ask. Spotify says it doesn&apos;t down-rank AI-assisted music; under-declaring is what
          gets releases corrected or pulled.
        </p>
        <div className="space-y-3">
          {DISCLOSURE_QUESTIONS.map((q) => (
            <div key={q.part} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{q.question}</p>
              <p className="mb-2 text-xs text-muted-foreground">{q.why}</p>
              <div role="radiogroup" aria-label={q.question} className="flex flex-wrap gap-1.5">
                {AI_LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={disclosure[q.part] === l.value}
                    title={l.hint}
                    onClick={() => setLevel(q.part, l.value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      disclosure[q.part] === l.value
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {answers.length ? (
          <div className="mt-4 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-medium">What to answer</p>
            {answers.map((a) => (
              <div key={a.where} className="flex items-start gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{a.where}:</span> {a.answer}
                </span>
                <CopyButton value={a.answer} size="icon" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Each distributor words its questions differently. Pick the closest option, and when unsure, the one with more AI.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Answer all four to see what to put in your distributor&apos;s form.</p>
        )}
      </Panel>

      <Panel title="2. Checks from this song" subtitle="Filled in from what you've done in the studio.">
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              {c.ok === true ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-signal-high" />
              ) : c.ok === false ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              {c.ok !== true && c.tab ? (
                <Button variant="outline" size="sm" onClick={() => onGoTab(c.tab!)} className="h-8 shrink-0 text-xs">
                  Open
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="3. Your checklist" subtitle="Only you can confirm these. Ticks are saved with the song.">
        <ul className="space-y-2">
          {MANUAL_CHECKS.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={Boolean(release.ticks?.[m.id])}
                  onChange={(e) => tick(m.id, e.target.checked)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-sm">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.detail}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <details className="mt-3 rounded-lg border border-border">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium">Suno&apos;s own pages on rights and distribution</summary>
          <ul className="space-y-1 px-3 pb-3 text-sm">
            {RELEASE_CHECKLIST.flatMap((item) => item.links ?? []).map(([label, href]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                  {label} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      </Panel>

      <Panel title="4. Lyrics for your distributor" subtitle="Plain lyrics without section tags, for the lyrics field when you upload.">
        {lyrics ? (
          <>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card/40 p-3 text-xs">{lyrics}</pre>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CopyButton value={lyrics} label="Copy lyrics" />
              {release.lrc ? (
                <CopyButton value={release.lrc} label="Copy synced lyrics (LRC)" />
              ) : (
                <Button variant="outline" size="sm" onClick={() => onGoTab("lyriccheck")} className="h-8 text-xs">
                  Get synced lyrics with Lyric Check
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No lyrics in this song yet.</p>
        )}
      </Panel>
    </div>
  );
}
