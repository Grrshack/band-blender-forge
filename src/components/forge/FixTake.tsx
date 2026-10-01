import { useServerFn } from "@tanstack/react-start";
import { Loader2, Stethoscope, Undo2 } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import { TakeLog } from "./TakeLog";
import type { BlendSlice, FixResult, FixSlice, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";
import { SUNO_LIMITS, composeSunoLyrics } from "@/lib/suno";
import { historyForPrompt, type Take } from "@/lib/takes";
import { cn } from "@/lib/utils";

const SYMPTOMS = [
  "Vocals sound robotic or over-polished",
  "Vocals buried or unclear",
  "Wrong vocal style or gender",
  "Bass is buried",
  "Bass is boomy or muddy",
  "Too fast",
  "Too slow",
  "Wrong genre",
  "Generic, sounds like AI",
  "Mix is too busy",
  "Sounds thin or weak",
  "Harsh, piercing highs",
  "Too repetitive",
  "Ending is abrupt",
  "Ignored my lyrics",
];

export function FixTake({
  blend,
  lyrics,
  value,
  onChange,
  onBlend,
  takes,
  onTakes,
}: {
  blend: BlendSlice;
  lyrics: LyricSlice;
  value: FixSlice;
  onChange: (next: FixSlice) => void;
  onBlend: (next: BlendSlice) => void;
  takes: Take[];
  onTakes: (next: Take[]) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const style = blend.result?.styleTag ?? "";
  const exclude = blend.result?.excludeStyles ?? "";
  const { symptoms, notes, result, undo } = value;

  const setBlendFields = (patch: { styleTag?: string; excludeStyles?: string }) =>
    onBlend({ ...blend, result: { ...(blend.result ?? {}), ...patch } });

  const toggle = (s: string) =>
    onChange({
      ...value,
      symptoms: symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s],
    });

  const run = async () => {
    if (!style.trim()) {
      setError("Paste the style prompt you gave Suno first (or run Band Blender).");
      return;
    }
    if (!symptoms.length && !notes.trim()) {
      setError("Pick at least one problem, or describe what you heard.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "fixTake",
          routing,
          apiKey,
          payload: {
            style,
            exclude,
            symptoms,
            notes,
            artists: blend.artists.filter((a) => a.trim()),
            lyrics: includeLyrics ? composeSunoLyrics(lyrics.sections).slice(0, 3500) : "",
            ...(takes.length ? { history: historyForPrompt(takes) } : {}),
          },
        },
      });
      onChange({ ...value, result: JSON.parse(res.json) as FixResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed.");
    } finally {
      setLoading(false);
    }
  };

  const apply = (r: FixResult) => {
    onChange({ ...value, undo: { styleTag: style, excludeStyles: exclude } });
    setBlendFields({
      styleTag: r.styleTag ?? style,
      excludeStyles: r.excludeStyles ?? exclude,
    });
  };

  const revert = () => {
    if (!undo) return;
    setBlendFields({ styleTag: undo.styleTag, excludeStyles: undo.excludeStyles });
    onChange({ ...value, undo: null });
  };

  const applied = Boolean(result && undo && style === (result.styleTag ?? style));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel
          title="Fix a Take"
          subtitle="Suno gave you something off? Say what you heard — only what's needed changes."
        >
          {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
          <div className="space-y-4">
            <div>
              <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Style prompt you used
              </span>
              <Textarea
                value={style}
                onChange={(e) => setBlendFields({ styleTag: e.target.value })}
                rows={4}
                placeholder="Paste the style prompt from Suno, or run Band Blender…"
                className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-primary"
              />
            </div>

            <div>
              <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                What was wrong
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS.map((s) => {
                  const on = symptoms.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(s)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        on
                          ? "border-primary/60 bg-primary/20 text-primary"
                          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                In your own words (optional)
              </span>
              <Textarea
                value={notes}
                onChange={(e) => onChange({ ...value, notes: e.target.value })}
                rows={4}
                placeholder="The chorus sounds great but the verses drag, and the singer keeps sliding off-key in the bridge…"
                className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
              />
            </div>

            {lyrics.sections.length ? (
              <label className="flex items-center gap-2.5 text-xs text-foreground/90">
                <input
                  type="checkbox"
                  checked={includeLyrics}
                  onChange={(e) => setIncludeLyrics(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Include my lyrics so fixes can point at exact lines
              </label>
            ) : null}

            <Button
              onClick={() => void run()}
              disabled={loading}
              className="glow-primary h-11 w-full gap-2 font-display tracking-wide"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Stethoscope className="size-4" />
              )}
              {loading ? "Diagnosing the prompt…" : "Diagnose & Revise"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Suno is random — the same prompt gives different takes. Change one thing at a time and
              generate a few takes before judging a revision.
            </p>
          </div>
        </Panel>

        <Panel
          title="Diagnosis"
          subtitle={
            result
              ? "Prompt-side causes and a minimal revision."
              : "Causes, a revised prompt, what to try next."
          }
        >
          {result ? (
            <div className="space-y-4">
              {result.diagnosis ? (
                <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90">
                  {result.diagnosis}
                </p>
              ) : null}

              {result.styleWarnings?.length ? (
                <p className="rounded-lg border border-signal-mid/50 bg-signal-mid/10 px-3 py-2 text-xs text-foreground/90">
                  Artist names were stripped from the revision (Suno blocks them):{" "}
                  <span className="font-mono text-signal-mid">
                    {result.styleWarnings.join(", ")}
                  </span>
                </p>
              ) : null}

              {result.changes?.length ? (
                <div className="rounded-lg border border-border bg-card/60 p-4">
                  <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    What changed
                  </h3>
                  <ul className="space-y-2.5">
                    {result.changes.map((c, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="font-display font-bold text-accent">{i + 1}</span>
                        <span>
                          <span className="text-foreground/90">{c.change}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.why}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.styleTag ? (
                <RevisedBox
                  label="Revised style prompt"
                  value={result.styleTag}
                  was={undo && applied ? undo.styleTag : style}
                  max={SUNO_LIMITS.style}
                />
              ) : null}
              {result.excludeStyles ? (
                <RevisedBox
                  label="Revised exclude styles"
                  value={result.excludeStyles}
                  was={undo && applied ? undo.excludeStyles : exclude}
                  max={SUNO_LIMITS.exclude}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => apply(result)}
                  disabled={applied}
                  className="glow-primary gap-2 font-display tracking-wide"
                >
                  {applied ? "Applied to Suno Sheet" : "Apply to Suno Sheet"}
                </Button>
                {undo ? (
                  <Button variant="outline" onClick={revert} className="gap-1.5 text-xs">
                    <Undo2 className="size-3.5" /> Undo apply
                  </Button>
                ) : null}
              </div>

              {result.lyricFixes?.length ? (
                <div className="rounded-lg border border-border bg-card/60 p-4">
                  <h3 className="mb-3 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Lyric fixes
                  </h3>
                  <ul className="space-y-3">
                    {result.lyricFixes.map((f, i) => (
                      <li key={i} className="border-l-2 border-destructive/60 pl-3">
                        <p className="text-sm text-foreground/90 line-through decoration-destructive/60">
                          {f.line}
                        </p>
                        <div className="mt-1.5 flex items-start gap-2">
                          <p className="flex-1 text-sm text-accent">{f.fix}</p>
                          <CopyButton value={f.fix ?? ""} size="icon" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.tryNext ? (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
                  <h3 className="mb-2 font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
                    If the next take is still off
                  </h3>
                  <p className="text-sm text-foreground/90">{result.tryNext}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 text-center">
              <Stethoscope className="size-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                You get the likely prompt-side cause of each problem, a revised style and exclude
                list that changes as little as possible, and what to adjust first if it's still
                wrong.
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Take Log"
        subtitle="Rate each take you generate. Your history makes the next diagnosis smarter."
      >
        <TakeLog
          takes={takes}
          onTakes={onTakes}
          style={style}
          exclude={exclude}
          onRestore={(s, e) => setBlendFields({ styleTag: s, excludeStyles: e })}
        />
      </Panel>
    </div>
  );
}

function RevisedBox({
  label,
  value,
  was,
  max,
}: {
  label: string;
  value: string;
  was: string;
  max: number;
}) {
  const over = value.length > max;
  return (
    <div className="rounded-lg border border-accent/40 bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px]",
              over ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {value.length.toLocaleString()} / {max.toLocaleString()}
          </span>
          <CopyButton value={value} size="icon" />
        </div>
      </div>
      <p className="font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-accent">
        {value}
      </p>
      {was && was !== value ? (
        <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-muted-foreground line-through decoration-muted-foreground/50">
          {was}
        </p>
      ) : null}
    </div>
  );
}
