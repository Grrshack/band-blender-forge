import { AudioWaveform, FileAudio, Loader2, Scissors, Stethoscope, Undo2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import { useForge } from "./use-forge";
import { TakeLog } from "./TakeLog";
import type { BlendSlice, FixResult, FixSlice, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUNO_LIMITS, composeSunoLyrics } from "@/lib/suno";
import { historyForPrompt, type Take } from "@/lib/takes";
import { measureTake, type TakeMeasurements } from "@/lib/audio/take-diagnosis";
import { submitPublicPrompt } from "@/lib/community.functions";
import { cn } from "@/lib/utils";
import { track } from "@/lib/stats";
import { SYMPTOMS } from "@/lib/symptoms";

export function FixTake({
  blend,
  lyrics,
  value,
  onChange,
  onBlend,
  takes,
  onTakes,
  onOpenMastering,
}: {
  onOpenMastering?: () => void;
  blend: BlendSlice;
  lyrics: LyricSlice;
  value: FixSlice;
  onChange: (next: FixSlice) => void;
  onBlend: (next: BlendSlice) => void;
  takes: Take[];
  onTakes: (next: Take[]) => void;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<TakeMeasurements | null>(null);
  const [audioName, setAudioName] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitRecipe = useServerFn(submitPublicPrompt);

  const shareRecipe = async (take: Take, title: string) => {
    try {
      await submitRecipe({
        data: {
          title,
          style_tag: take.style,
          ...(take.exclude ? { exclude_styles: take.exclude } : {}),
          artists: blend.artists.filter((a) => a.trim()),
          genre_tags: blend.targetGenre ? [blend.targetGenre] : [],
          ...(take.sunoUrl ? { suno_url: take.sunoUrl } : {}),
          ...(take.note ? { recipe_note: take.note.slice(0, 300) } : {}),
        },
      });
      toast.success("Recipe shared to the community library.");
      track("recipe_shared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share the recipe.");
      throw e;
    }
  };

  const loadAudio = async (file: File) => {
    setAudioError(null);
    setMeasuring(true);
    setAudioName(file.name);
    try {
      setAudio(await measureTake(file));
    } catch (e) {
      setAudio(null);
      setAudioError(e instanceof Error ? e.message : "Couldn't measure that file.");
    } finally {
      setMeasuring(false);
    }
  };

  const style = blend.result?.styleTag ?? "";
  const exclude = blend.result?.excludeStyles ?? "";
  const { symptoms, notes, result, undo } = value;
  const moments = value.moments ?? [];
  const setMoment = (i: number, patch: Partial<{ time: string; note: string }>) =>
    onChange({ ...value, moments: moments.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const setBlendFields = (patch: { styleTag?: string; excludeStyles?: string }) =>
    onBlend({ ...blend, result: { ...(blend.result ?? {}), ...patch } });

  const toggle = (s: string) =>
    onChange({
      ...value,
      symptoms: symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s],
    });

  const run = async () => {
    const noted = moments.filter((m) => m.note.trim());
    if (!symptoms.length && !notes.trim() && !audio && !noted.length) {
      setError("Pick at least one problem, describe what you heard, or add the song file.");
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
            ...(audio ? { audio } : {}),
            ...(noted.length ? { moments: noted.slice(0, 12) } : {}),
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
          title="Fix a Track"
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
                placeholder="Paste the style prompt from Suno, or run Band Blender. Leave empty if you don't have it."
                className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-primary"
              />
            </div>

            <div>
              <span className="mb-1 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Where in the song? (no download needed)
              </span>
              <p className="mb-2 text-xs text-muted-foreground">
                Play the take on Suno and note the times. Suno downloads are limited, so save them
                for keepers.
              </p>
              <div className="space-y-1.5">
                {moments.map((m, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input
                      value={m.time}
                      onChange={(e) => setMoment(i, { time: e.target.value })}
                      placeholder="1:32"
                      aria-label="Time"
                      maxLength={6}
                      className="h-8 w-16 shrink-0 font-mono text-xs"
                    />
                    <Input
                      value={m.note}
                      onChange={(e) => setMoment(i, { note: e.target.value })}
                      placeholder="Vocal goes robotic on the high note"
                      aria-label="What you heard"
                      maxLength={200}
                      className="h-8 text-xs"
                    />
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => onChange({ ...value, moments: moments.filter((_, j) => j !== i) })}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={moments.length >= 12}
                  onClick={() => onChange({ ...value, moments: [...moments, { time: "", note: "" }] })}
                >
                  + Add a moment
                </Button>
              </div>
            </div>

            <AudioDrop
              name={audioName}
              audio={audio}
              measuring={measuring}
              error={audioError}
              fileRef={fileRef}
              onFile={(f) => void loadAudio(f)}
              onClear={() => {
                setAudio(null);
                setAudioName("");
                setAudioError(null);
              }}
            />

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
              : "The cause, the best route to fix it, and what to paste."
          }
        >
          {result ? (
            <div className="space-y-4">
              {result.fixRoute ? (
                <RouteBanner
                  route={result.fixRoute}
                  why={result.routeWhy}
                  onOpenMastering={onOpenMastering}
                />
              ) : null}

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

              {result.sunoEdits?.some((e) => e.instruction?.trim()) ? (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Scissors className="size-4 text-primary" /> Edit this take in Suno v6
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Keep what works and change only these parts. Paste each instruction into
                    Suno's edit feature on the song.
                  </p>
                  <ul className="space-y-2">
                    {result.sunoEdits
                      .filter((e) => e.instruction?.trim())
                      .map((e, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-md border border-border bg-card/60 p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            {e.target ? (
                              <p className="text-xs font-medium text-primary">{e.target}</p>
                            ) : null}
                            <p className="text-sm text-foreground/90">{e.instruction}</p>
                          </div>
                          <CopyButton value={e.instruction ?? ""} size="icon" />
                        </li>
                      ))}
                  </ul>
                </div>
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
                You get the likely cause of each problem, the best way to fix it (edit the take in
                Suno, regenerate, or master), ready-to-paste edit instructions, and a revised style
                prompt that changes as little as possible.
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
          onShareRecipe={shareRecipe}
          defaultTitle={blend.artists.filter((a) => a.trim()).slice(0, 2).join(" × ")}
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

const ROUTES = {
  edit: { title: "Best route: edit this take in Suno", tone: "border-primary/50 bg-primary/10 text-primary" },
  regenerate: {
    title: "Best route: regenerate with the revised prompt",
    tone: "border-accent/50 bg-accent/10 text-accent",
  },
  master: { title: "Best route: fix it in Mastering", tone: "border-signal-high/50 bg-signal-high/10 text-signal-high" },
} as const;

function RouteBanner({
  route,
  why,
  onOpenMastering,
}: {
  route: "edit" | "regenerate" | "master";
  why?: string | undefined;
  onOpenMastering?: (() => void) | undefined;
}) {
  const r = ROUTES[route] ?? ROUTES.regenerate;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3", r.tone)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{r.title}</p>
        {why ? <p className="mt-0.5 text-xs text-foreground/80">{why}</p> : null}
      </div>
      {route === "master" && onOpenMastering ? (
        <Button size="sm" variant="outline" onClick={onOpenMastering} className="gap-1.5">
          <AudioWaveform className="size-3.5" /> Open Mastering
        </Button>
      ) : null}
    </div>
  );
}

function AudioDrop({
  name,
  audio,
  measuring,
  error,
  fileRef,
  onFile,
  onClear,
}: {
  name: string;
  audio: TakeMeasurements | null;
  measuring: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div>
      <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        The song file (optional, if you already downloaded it)
      </span>
      {!audio && !measuring ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors",
            over ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/50",
          )}
        >
          <FileAudio className="size-5 text-primary" />
          <span className="text-sm text-foreground/90">Drop the audio file or click to choose</span>
          <span className="text-xs text-muted-foreground">
            Measured in your browser. The file is never uploaded.
          </span>
        </button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {measuring ? (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Listening to {name}…
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {audio ? (
        <div className="space-y-2.5 rounded-lg border border-border bg-card/40 p-3">
          <div className="flex items-center gap-2">
            <FileAudio className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.floor(audio.durationSec / 60)}:{String(audio.durationSec % 60).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="Remove file"
              onClick={onClear}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <LoudnessStrip contour={audio.contourDb} />
          {audio.flags.length ? (
            <ul className="space-y-1">
              {audio.flags.map((f) => (
                <li key={f} className="flex gap-2 text-xs text-foreground/90">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-signal-mid" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No clipping, abrupt ending or flat dynamics found. The frequency balance goes to the
              diagnosis.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A small bar chart of loudness from start to end, so sections that don't lift are visible. */
function LoudnessStrip({ contour }: { contour: number[] }) {
  if (!contour.length) return null;
  const max = Math.max(...contour);
  const min = Math.max(max - 30, Math.min(...contour));
  return (
    <div>
      <div className="flex h-10 items-end gap-0.5" aria-label="Loudness across the song">
        {contour.map((d, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-primary/60"
            style={{ height: `${Math.max(6, ((d - min) / Math.max(1, max - min)) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Start</span>
        <span>Loudness across the song</span>
        <span>End</span>
      </div>
    </div>
  );
}
