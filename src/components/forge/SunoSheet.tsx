import { AlertTriangle, CheckCircle2, ExternalLink, Plus, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import { SendToChat } from "./SendToChat";
import { StyleFormatSwitch } from "./StyleFormatSwitch";
import { SendToEngine, SendToSuno } from "./SendToSuno";
import { ShareExport } from "./ShareExport";
import { SoundProfiles } from "./SoundProfiles";
import { StyleVariants } from "./StyleVariants";
import type { BlendResult, BlendSlice, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SUNO_LIMITS,
  composeSunoLyrics,
  findStyleLeaks,
  scrubArtistNames,
  vocalString,
} from "@/lib/suno";
import { ENGINE_LABELS, buildEngineExport, type Engine } from "@/lib/engines";
import { preflight } from "@/lib/preflight";
import {
  COMMON_EXCLUDES,
  MIX_CLAUSES,
  SUNO_PASSES,
  activeFormat,
  addClause,
  hasClause,
  mergeExcludes,
  placeVocal,
  exportLyrics,
  type Clause,
} from "@/lib/prompt-craft";
import { cn } from "@/lib/utils";

function Counter({ n, max }: { n: number; max: number }) {
  const tone =
    n > max ? "text-destructive" : n > max * 0.9 ? "text-signal-mid" : "text-muted-foreground";
  return (
    <span className={cn("font-mono text-[10px]", tone)}>
      {n.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function SunoBox({
  label,
  value,
  max,
  onChange,
  rows,
  mono,
  hint,
  extra,
}: {
  label: string;
  value: string;
  /** Character limit; leave out when the platform publishes none. */
  max?: number | undefined;
  onChange?: (v: string) => void;
  rows?: number;
  mono?: boolean;
  hint?: string;
  extra?: ReactNode;
}) {
  const over = max !== undefined && value.length > max;
  const common = cn(
    "border-border bg-card/60 text-sm focus-visible:ring-primary",
    mono && "font-mono text-accent",
    over && "border-destructive/60",
  );
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {max !== undefined ? <Counter n={value.length} max={max} /> : null}
          <CopyButton value={value} size="icon" />
        </div>
      </div>
      {rows ? (
        <Textarea
          value={value}
          rows={rows}
          readOnly={!onChange}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn("resize-y", common)}
        />
      ) : (
        <Input
          value={value}
          readOnly={!onChange}
          onChange={(e) => onChange?.(e.target.value)}
          className={common}
        />
      )}
      {over ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="size-3.5" />
          {(value.length - (max ?? 0)).toLocaleString()} characters over — Suno cuts off or rejects
          anything past {(max ?? 0).toLocaleString()}.
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
      {extra}
    </div>
  );
}

export function SunoSheet({
  blend,
  lyrics,
  onBlend,
  onLyrics,
  onOpenForge,
}: {
  blend: BlendSlice;
  lyrics: LyricSlice;
  onBlend: (next: BlendSlice) => void;
  onLyrics: (next: LyricSlice) => void;
  onOpenForge: () => void;
}) {
  const [engine, setEngine] = useState<Engine>("suno");
  const result = blend.result;
  const style = result?.styleTag ?? "";
  const exclude = result?.excludeStyles ?? "";
  const vocal = vocalString(result?.vocalPrompt);
  const cleanEnding = lyrics.cleanEnding !== false;
  const rawLyrics = composeSunoLyrics(lyrics.sections);
  const exported = exportLyrics(rawLyrics, cleanEnding);
  const lyricText = exported.text;
  const names = blend.artists.map((a) => a.trim()).filter(Boolean);

  const setResult = (patch: Partial<BlendResult>) =>
    onBlend({ ...blend, result: { ...(result ?? {}), ...patch } });

  const styleLeaks = findStyleLeaks(style, names);
  const excludeLeaks = findStyleLeaks(exclude, names);
  const leaks = [...new Set([...styleLeaks, ...excludeLeaks])];

  const stripArtists = () =>
    setResult({
      styleTag: scrubArtistNames(style, names).text,
      excludeStyles: scrubArtistNames(exclude, names).text,
    });

  const addVocal = () => {
    if (!vocal) return;
    const base = style.replace(/[,\s]+$/, "");
    setResult({ styleTag: base ? `${base}, ${vocal}` : vocal });
  };

  const applyClause = (c: Clause) => {
    const next = addClause(style, c);
    setResult({
      styleTag: next,
      ...(c.exclude ? { excludeStyles: mergeExcludes(exclude, c.exclude, next) } : {}),
    });
  };

  const commonMerged = mergeExcludes(exclude, COMMON_EXCLUDES, style);

  const vocalAlreadyIn = Boolean(vocal) && style.toLowerCase().includes(vocal.toLowerCase());

  const problems = [
    !style.trim() && "no style prompt",
    !lyricText.trim() && "no lyrics",
    !lyrics.title.trim() && "no title",
    style.length > SUNO_LIMITS.style && "style is over the limit",
    exclude.length > SUNO_LIMITS.exclude && "exclude list is over the limit",
    lyricText.length > SUNO_LIMITS.lyrics && "lyrics are over the limit",
    lyrics.title.length > SUNO_LIMITS.title && "title is over the limit",
    leaks.length > 0 && "artist names in the style fields",
  ].filter(Boolean) as string[];

  const engineFields =
    engine === "suno"
      ? []
      : buildEngineExport(engine, {
          title: lyrics.title,
          style,
          exclude,
          vocal,
          genre: result?.genre,
          tempo: result?.tempo,
          mood: result?.mood,
          instrumentation: result?.instrumentation,
          lyrics: lyricText,
        });

  const everything = [
    `TITLE\n${lyrics.title}`,
    `STYLE\n${style}`,
    exclude ? `EXCLUDE STYLES\n${exclude}` : "",
    `LYRICS\n${lyricText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Panel
      title="Export Sheet"
      subtitle="Check, then paste into Suno. Every box is ready to copy."
      action={
        <div className="flex flex-wrap justify-end gap-1.5">
          <CopyButton value={everything} label="Copy all" />
          {engine === "suno" ? (
            <>
              <SendToSuno payload={{ title: lyrics.title, style, exclude, lyrics: lyricText, artists: names }} />
              <SendToChat song={{ title: lyrics.title, style, exclude, lyrics: lyricText }} disabled={!style.trim()} />
            </>
          ) : (
            <SendToEngine engine={engine} fields={engineFields.map((f) => ({ label: f.label, value: f.value, main: f.label.startsWith("Prompt") }))} />
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/50 bg-primary/10 text-xs hover:bg-primary/20"
          >
            <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer">
              Open Suno <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PreflightCard
          issues={preflight({ style, exclude, version: blend.sunoVersion, artistNames: names })}
          onFix={(fix) => {
            if (fix === "placeVocal") {
              const next = placeVocal(style);
              setResult({ styleTag: next, excludeStyles: mergeExcludes(exclude, "buried vocals, distant vocals", next) });
            }
          }}
        />
        <div
          role="radiogroup"
          aria-label="Target engine"
          className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-background/40 p-1 sm:grid-cols-3"
        >
          {(Object.keys(ENGINE_LABELS) as Engine[]).map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={engine === e}
              onClick={() => setEngine(e)}
              className={cn(
                "rounded-md px-2 py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors",
                engine === e
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ENGINE_LABELS[e]}
            </button>
          ))}
        </div>

        {engine !== "suno" ? (
          <>
            {leaks.length ? (
              <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs">
                Artist names found in the style ({leaks.join(", ")}) — most engines block them.
                Switch to Suno v6 and press "Remove them".
              </p>
            ) : null}
            {engineFields.map((f) => (
              <SunoBox
                key={f.label}
                label={f.label}
                value={f.value}
                max={f.max ?? (f.label === "Title" ? 200 : undefined)}
                rows={f.label === "Title" ? 0 : f.value.length > 400 ? 14 : 4}
                mono={f.label === "Prompt"}
                {...(f.hint ? { hint: f.hint } : {})}
              />
            ))}
            <p className="hairline-top pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Built from the same blend and lyrics as the Suno version. Edit them in Band Blender or
              Lyric Forge; limits are approximate and live in one place if the engines change.
            </p>
          </>
        ) : (
        <>
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs",
            problems.length
              ? "border-signal-mid/50 bg-signal-mid/10"
              : "border-signal-high/50 bg-signal-high/10",
          )}
        >
          {problems.length ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-signal-mid" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-signal-high" />
          )}
          <p className="leading-relaxed text-foreground/90">
            {problems.length
              ? `Not ready yet: ${problems.join(", ")}.`
              : "Everything fits Suno's limits and no artist names are in the style fields."}
          </p>
        </div>

        {leaks.length ? (
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/90">
              Suno blocks artist names. Found:{" "}
              <span className="font-mono text-destructive">{leaks.join(", ")}</span>
            </p>
            <Button size="sm" variant="outline" onClick={stripArtists} className="h-7 text-xs">
              Remove them
            </Button>
          </div>
        ) : null}

        <SoundProfiles blend={blend} onBlend={onBlend} />

        <SunoBox
          label="Title"
          value={lyrics.title}
          max={SUNO_LIMITS.title}
          onChange={(v) => onLyrics({ ...lyrics, title: v })}
          hint="Doesn't change how the song sounds."
        />

        {result?.styleTag ? (
          <StyleFormatSwitch
            result={result}
            sunoVersion={blend.sunoVersion}
            onResult={(next) => onBlend({ ...blend, result: next, promptFormat: activeFormat(next) })}
          />
        ) : null}
        <SunoBox
          label="Style of music"
          value={style}
          max={SUNO_LIMITS.style}
          rows={5}
          mono
          onChange={(v) => setResult({ styleTag: v })}
          hint="Front-load genre and mood — if anything gets cut, it's the end."
          extra={
            vocal ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/40 p-2">
                <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  <span className="font-mono tracking-[0.16em] text-primary uppercase">
                    Vocal line
                  </span>{" "}
                  {vocal}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={vocalAlreadyIn}
                  onClick={addVocal}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="size-3" /> {vocalAlreadyIn ? "Added" : "Add to style"}
                </Button>
              </div>
            ) : null
          }
        />

        <ClauseChips style={style} onAdd={applyClause} />

        <StyleVariants blend={blend} onBlend={onBlend} />

        <SunoBox
          label="Exclude styles"
          value={exclude}
          max={SUNO_LIMITS.exclude}
          rows={2}
          mono
          onChange={(v) => setResult({ excludeStyles: v })}
          hint="Paste into Suno's Exclude Styles field — keep negatives out of the style box."
          extra={
            commonMerged !== exclude && commonMerged.length <= SUNO_LIMITS.exclude ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setResult({ excludeStyles: commonMerged })}
                className="mt-2 h-7 gap-1 text-xs"
                title={COMMON_EXCLUDES}
              >
                <Plus className="size-3" /> Add the usual suspects
              </Button>
            ) : null
          }
        />

        <SunoBox
          label="Lyrics"
          value={lyricText}
          max={SUNO_LIMITS.lyrics}
          rows={14}
          hint="Section tags and [cues] are included. Edit lines in Lyric Forge."
          extra={
            <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={cleanEnding}
                onChange={(e) => onLyrics({ ...lyrics, cleanEnding: e.target.checked })}
                className="accent-primary"
              />
              Clean ending: add a short instrumental outro and an [End] marker
            </label>
            {exported.noRoom ? (
              <span className="text-[11px] text-signal-mid">
                Left off: the lyrics are too close to Suno&apos;s {SUNO_LIMITS.lyrics.toLocaleString()}-character limit. Trim a line or two to make room.
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenForge}
              className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              Open Lyric Forge
            </Button>
            </div>
          }
        />

        <SunoSettingsCard />

        <ShareExport
          disabled={!style.trim() && !lyricText.trim()}
          payload={{
            v: 1,
            title: lyrics.title,
            style,
            exclude,
            vocal,
            lyrics: lyricText,
          }}
        />

        <p className="hairline-top pt-3 text-[11px] leading-relaxed text-muted-foreground">
          Limits are third-party measurements of Suno's current fields and can change — they live in
          one place (<span className="font-mono">src/lib/suno.ts</span>) if Suno updates them.
        </p>
        </>
        )}
      </div>
    </Panel>
  );
}

/**
 * Runs before the person goes to Suno: a generation (and, after it, one of their limited
 * downloads) is the expensive part, so catch prompt problems first.
 */
function PreflightCard({
  issues,
  onFix,
}: {
  issues: ReturnType<typeof preflight>;
  onFix?: (fix: NonNullable<ReturnType<typeof preflight>[number]["fix"]>) => void;
}) {
  const stops = issues.filter((i) => i.level === "stop");
  const ok = issues.length === 0;
  return (
    <section
      aria-label="Pre-flight check"
      className={cn(
        "rounded-lg border p-3",
        ok
          ? "border-signal-high/40 bg-signal-high/5"
          : stops.length
            ? "border-destructive/50 bg-destructive/5"
            : "border-signal-mid/50 bg-signal-mid/5",
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {ok ? (
          <CheckCircle2 className="size-4 text-signal-high" />
        ) : (
          <AlertTriangle className={cn("size-4", stops.length ? "text-destructive" : "text-signal-mid")} />
        )}
        {ok
          ? "Pre-flight check passed"
          : `Pre-flight check: ${issues.length} thing${issues.length > 1 ? "s" : ""} to look at before you generate`}
      </p>
      {ok ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No contradictions, artist names or overlong prompt found. Suno downloads are limited, so
          judge takes by listening on Suno first and download only the keeper.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {issues.map((i) => (
            <li key={i.message} className="flex gap-2 text-xs text-foreground/90">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  i.level === "stop" ? "bg-destructive" : "bg-signal-mid",
                )}
              />
              <span className="min-w-0 flex-1">
                {i.message}
                {i.fix && onFix ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onFix(i.fix!)}
                    className="ml-2 h-6 px-2 text-[11px]"
                  >
                    Fix it
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One-tap mix and arrangement clauses, written in the style's own format. */
function ClauseChips({ style, onAdd }: { style: string; onAdd: (c: Clause) => void }) {
  return (
    <section aria-label="Mix clauses" className="rounded-lg border border-border bg-card/40 p-3">
      <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Finish the prompt</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Short production lines that steer the mix and arrangement. Each one also adds what to keep
        out to Exclude styles.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MIX_CLAUSES.map((c) => {
          const added = hasClause(style, c);
          const tooLong = addClause(style, c).length > SUNO_LIMITS.style;
          return (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={added || tooLong}
              onClick={() => onAdd(c)}
              title={tooLong ? "Not enough room left in the style box" : c.help}
              className={cn("h-7 gap-1 text-xs", added && "border-primary/50 text-primary")}
            >
              {added ? <CheckCircle2 className="size-3" /> : <Plus className="size-3" />}
              {c.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/** Slider routine. Community-tested starting points, not official Suno numbers. */
function SunoSettingsCard() {
  return (
    <details className="rounded-lg border border-border bg-card/40 p-3">
      <summary className="cursor-pointer font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
        Suno settings: a three-pass routine
      </summary>
      <ol className="mt-3 space-y-2.5">
        {SUNO_PASSES.map((p, i) => (
          <li key={p.name} className="flex gap-3 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] text-primary">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {p.name} <span className="font-normal text-muted-foreground">· {p.when}</span>
              </p>
              <p className="font-mono text-[11px] text-accent">{p.settings}</p>
              <p className="text-muted-foreground">{p.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Starting points from community testing, not Suno's official numbers. Slider names and
        ranges can change between Suno versions.
      </p>
    </details>
  );
}
