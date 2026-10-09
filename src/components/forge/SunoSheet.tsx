import { AlertTriangle, CheckCircle2, ExternalLink, Plus, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
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
  max: number;
  onChange?: (v: string) => void;
  rows?: number;
  mono?: boolean;
  hint?: string;
  extra?: ReactNode;
}) {
  const over = value.length > max;
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
          <Counter n={value.length} max={max} />
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
          {(value.length - max).toLocaleString()} characters over — Suno cuts off or rejects
          anything past {max.toLocaleString()}.
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
  const lyricText = composeSunoLyrics(lyrics.sections);
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
      subtitle="Pick your engine — every box is paste-ready for it."
      action={
        <div className="flex flex-wrap justify-end gap-1.5">
          <CopyButton value={everything} label="Copy all" />
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
        <div
          role="radiogroup"
          aria-label="Target engine"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background/40 p-1"
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
            {buildEngineExport(engine, {
              title: lyrics.title,
              style,
              exclude,
              vocal,
              genre: result?.genre,
              tempo: result?.tempo,
              mood: result?.mood,
              instrumentation: result?.instrumentation,
              lyrics: lyricText,
            }).map((f) => (
              <SunoBox
                key={f.label}
                label={f.label}
                value={f.value}
                max={f.max ?? 200}
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

        <StyleVariants blend={blend} onBlend={onBlend} />

        <SunoBox
          label="Exclude styles"
          value={exclude}
          max={SUNO_LIMITS.exclude}
          rows={2}
          mono
          onChange={(v) => setResult({ excludeStyles: v })}
          hint="Paste into Suno's Exclude Styles field — keep negatives out of the style box."
        />

        <SunoBox
          label="Lyrics"
          value={lyricText}
          max={SUNO_LIMITS.lyrics}
          rows={14}
          hint="Section tags and [cues] are included. Edit lines in Lyric Forge."
          extra={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenForge}
              className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              Open Lyric Forge
            </Button>
          }
        />

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
