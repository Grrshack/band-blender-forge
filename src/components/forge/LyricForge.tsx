import { ChevronDown,
  AlertTriangle,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Rows3,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { LengthPlanner } from "./LengthPlanner";
import { useSettings } from "./settings";
import { useForge } from "./use-forge";
import { LYRIC_VOICES, RHYME_STYLES, analyzeSection, type LineRhyme } from "@/lib/rhyme";
import type { BlendResult, LyricSlice, Section } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  countSyllables,
  countWatchWordOccurrences,
  findCliches,
  isSyllableOutlier,
  mergeWordCounts,
} from "@/lib/cliches";
import { findBannedWords, parseBannedWords } from "@/lib/banned-words";
import { findPronunciationRisks } from "@/lib/pronunciation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { composeSunoLyrics, vocalString } from "@/lib/suno";
import { LYRIC_NOTATION, exportLyrics } from "@/lib/prompt-craft";
import { cn } from "@/lib/utils";

/** Estimated syllables, plus a flag for worn-out phrases and lines far off the section's typical length. */
function LineMarkers({
  text,
  locked,
  all,
  index,
  banned,
}: {
  text: string;
  locked: boolean;
  all: string[];
  index: number;
  banned: string[];
}) {
  const blocked = findBannedWords(text, banned);
  const counts = all.map((t) => countSyllables(t));
  const syllables = counts[index] ?? 0;
  const outlier = isSyllableOutlier(counts, index);
  const worn = locked ? [] : findCliches(text);
  const say = findPronunciationRisks(text);
  return (
    <div className="mr-1 flex items-center gap-1.5">
      {say.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Pronunciation check: ${say.map((r) => r.word).join(", ")}`}
              className="rounded bg-accent/15 px-1 font-mono text-[10px] text-accent"
            >
              SAY
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs space-y-1.5 text-left">
            {say.map((r) => (
              <p key={r.word} className="text-xs leading-snug">
                <span className="font-semibold">{r.word}</span>: {r.why}{" "}
                <span className="font-medium">Try: {r.suggestion}</span>
              </p>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {blocked.length ? (
        <span
          title={`Uses a banned word: "${blocked.join('", "')}". Regenerate or rewrite this line.`}
          className="rounded bg-destructive/15 px-1 font-mono text-[10px] text-destructive"
        >
          BAN
        </span>
      ) : null}
      {worn.length ? (
        <span
          title={`Worn-out phrase: "${worn[0]}". Regenerate or rewrite this line.`}
          className="text-signal-mid"
        >
          <AlertTriangle className="size-3.5" />
        </span>
      ) : null}
      <span
        title={
          outlier
            ? "Much longer or shorter than the other lines here — may be hard to sing in time."
            : "Estimated syllables"
        }
        className={cn(
          "font-mono text-[10px] tabular-nums",
          outlier ? "rounded bg-signal-mid/15 px-1 text-signal-mid" : "text-muted-foreground/70",
        )}
      >
        {syllables || ""}
      </span>
    </div>
  );
}

const QUICK_SECTIONS = [
  "[Guitar Solo]",
  "[Instrumental Break]",
  "[Drop]",
  "[Breakdown]",
  "[Outro]",
];

export function LyricForge({
  value,
  onChange,
  blend,
  renderTakeCheck,
}: {
  /** The "how did it come out?" card, shown once there are lyrics. */
  renderTakeCheck?: ((opts: { highlight: boolean }) => ReactNode) | undefined;
  value: LyricSlice;
  onChange: (next: LyricSlice) => void;
  blend: BlendResult | null;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  const {
    theme,
    hook,
    notes,
    title,
    sections,
    tagsOnly = false,
    manualStyle = "",
    recentWords = {},
    bannedWords = "",
    rhymeStyle = "classic",
    voice = "polished",
    showRhymes = false,
  } = value;
  const rhymeInfo = useMemo(() => sections.map((s) => analyzeSection(s.lines.map((l) => l.text))), [sections]);
  const trapCount = rhymeInfo.filter((r) => r.trap).length;
  const styleOpts = {
    ...(rhymeStyle !== "classic" ? { rhymeStyle } : {}),
    ...(voice !== "polished" ? { voice } : {}),
  };
  const banned = parseBannedWords(bannedWords);
  const bannedHits = sections.reduce(
    (n, s) => n + s.lines.filter((l) => findBannedWords(l.text, banned).length).length,
    0,
  );
  const set = (patch: Partial<LyricSlice>) => onChange({ ...value, ...patch });

  const hasBlend = Boolean(blend?.styleTag);
  const styleContext = {
    styleTag: blend?.styleTag ?? manualStyle,
    genre: blend?.genre ?? "",
    vocals: blend?.vocals ?? "",
    mood: blend?.mood ?? "",
    vocalPrompt: vocalString(blend?.vocalPrompt),
  };

  const generate = async () => {
    // Theme is optional — model will choose a direction if left blank.
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "lyrics",
          routing,
          apiKey,
          payload: {
            theme,
            hookIdea: hook,
            notes,
            style: styleContext,
            bannedWords: banned,
            ...styleOpts,
            ...(value.structure ? { structure: value.structure } : {}),
            ...(tagsOnly ? { tagsOnly: true } : {}),
            ...(value.instrumentalIntro ? { instrumentalIntro: true } : {}),
            // Words used >= 2 times in previous generations get soft-avoided
            ...(Object.keys(recentWords).length > 0
              ? {
                  avoidWords: Object.entries(recentWords)
                    .filter(([, n]) => n >= 2)
                    .map(([w]) => w),
                }
              : {}),
          },
        },
      });
      const out = JSON.parse(res.json) as {
        title?: string;
        sections?: Array<{ tag?: string; cue?: string; lines?: string[] }>;
      };
      const newSections = (out.sections ?? []).map((s) => ({
        tag: s.tag ?? "[Section]",
        ...(s.cue ? { cue: s.cue } : {}),
        lines: (s.lines ?? []).map((t) => ({ text: t, locked: false })),
      }));
      // Track watch-word usage across generations for soft-avoidance next time
      const allLines = newSections.flatMap((s) => s.lines.map((l) => l.text));
      const newCounts = countWatchWordOccurrences(allLines);
      set({
        title: out.title ?? "",
        sections: newSections,
        recentWords: mergeWordCounts(recentWords, newCounts),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const patchSections = (fn: (s: Section[]) => Section[]) => set({ sections: fn(sections) });

  const setCue = (si: number, cue: string) =>
    patchSections((prev) => prev.map((s, i) => (i === si ? { ...s, cue } : s)));

  const addSection = (tag: string) => patchSections((prev) => [...prev, { tag, lines: [] }]);

  const removeSection = (si: number) => patchSections((prev) => prev.filter((_, i) => i !== si));

  const toggleLock = (si: number, li: number) =>
    patchSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, lines: s.lines.map((l, j) => (j === li ? { ...l, locked: !l.locked } : l)) }
          : s,
      ),
    );

  const editLine = (si: number, li: number, text: string, keepPrevious?: string) =>
    patchSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              lines: s.lines.map((l, j) =>
                j === li
                  ? {
                      ...l,
                      text,
                      ...(keepPrevious !== undefined ? { previous: keepPrevious } : {}),
                    }
                  : l,
              ),
            }
          : s,
      ),
    );

  const undoLine = (si: number, li: number) =>
    patchSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              lines: s.lines.map((l, j) =>
                j === li && l.previous !== undefined ? { text: l.previous, locked: l.locked } : l,
              ),
            }
          : s,
      ),
    );

  const regenLine = async (si: number, li: number) => {
    const section = sections[si];
    const line = section?.lines[li];
    if (!section || !line || line.locked) return;
    setBusy(`${si}-${li}`);
    try {
      const res = await forge({
        data: {
          task: "regenLine",
          routing,
          apiKey,
          payload: {
            theme,
            style: styleContext,
            sectionTag: section.tag,
            lineToRewrite: line.text,
            bannedWords: banned,
            ...styleOpts,
            sectionLines: section.lines.map((l) => l.text),
          },
        },
      });
      const out = JSON.parse(res.json) as { line?: string };
      if (out.line) editLine(si, li, out.line, line.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Line rewrite failed.");
    } finally {
      setBusy(null);
    }
  };

  const regenSection = async (si: number, opts: { loosenRhymes?: boolean } = {}) => {
    const section = sections[si];
    if (!section) return;
    setBusy(`s-${si}`);
    try {
      const res = await forge({
        data: {
          task: "regenSection",
          routing,
          apiKey,
          payload: {
            theme,
            hookIdea: hook,
            notes,
            style: styleContext,
            sectionTag: section.tag,
            cue: section.cue ?? "",
            bannedWords: banned,
            ...styleOpts,
            ...(opts.loosenRhymes ? { loosenRhymes: true } : {}),
            lines: section.lines.map((l) => ({ text: l.text, locked: l.locked })),
            otherSections: sections
              .filter((_, i) => i !== si)
              .map((s) => ({ tag: s.tag, cue: s.cue ?? "", lines: s.lines.map((l) => l.text) })),
          },
        },
      });
      const out = JSON.parse(res.json) as { lines?: string[] };
      if (out.lines?.length) {
        patchSections((prev) =>
          prev.map((s, i) =>
            i === si
              ? {
                  ...s,
                  lines: s.lines.map((l, j) =>
                    l.locked
                      ? l
                      : { text: out.lines?.[j] ?? l.text, locked: false, previous: l.text },
                  ),
                }
              : s,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Section rewrite failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
      <Panel title="Lyric Brief" subtitle="Hook-first writing. No AI clichés.">
        {error ? <ErrorNote message={error} onRetry={() => void generate()} /> : null}
        <div className="space-y-4">
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Song subject{" "}
              <span className="normal-case text-muted-foreground/60">
                (optional — leave blank to let the model choose)
              </span>
            </span>
            <Textarea
              value={theme}
              onChange={(e) => set({ theme: e.target.value })}
              rows={4}
              placeholder="A night-shift nurse driving home at 6am… or leave blank for open direction"
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Hook idea (optional)
            </span>
            <Input
              value={hook}
              onChange={(e) => set({ hook: e.target.value })}
              placeholder="Something chantable…"
              className="border-border bg-card/60 focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Constraints (optional)
            </span>
            <Textarea
              value={notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={4}
              placeholder="Short lines, present tense, no rhyme on the chorus…"
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
          </div>

          <ChoiceGroup
            label="Rhyme"
            options={RHYME_STYLES}
            value={rhymeStyle}
            onChange={(v) => set({ rhymeStyle: v })}
          />
          <ChoiceGroup
            label="Voice"
            options={LYRIC_VOICES}
            value={voice}
            onChange={(v) => set({ voice: v })}
          />

          {/* Extra controls fold away; the summary line says which ones are switched on. */}
          <details className="group rounded-lg border border-border bg-card/30">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="flex-1">
                <span className="block text-sm font-medium">More options</span>
                <span className="block text-xs text-muted-foreground">
                  {[
                    banned.length ? `${banned.length} banned word${banned.length === 1 ? "" : "s"}` : "Banned words",
                    hasBlend ? "style linked" : manualStyle.trim() ? "style pasted" : "style",
                    value.structure ? "length plan on" : "length plan",
                    tagsOnly ? "structure only ON" : "structure only",
                  ].join(" · ")}
                </span>
              </span>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 px-3 pb-3">
            <div>
              <span className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Banned words
                {banned.length ? (
                  <span className="tracking-normal normal-case">
                    {banned.length} blocked
                    {bannedHits ? (
                      <span className="text-destructive"> · {bannedHits} line(s) use them</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <Input
                value={bannedWords}
                onChange={(e) => set({ bannedWords: e.target.value })}
                placeholder="alone, voice, fire, neon…"
                className="border-border bg-card/60 text-sm focus-visible:ring-primary"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Comma-separated. The AI won't use these, and any line that does gets a BAN flag.
              </p>
            </div>

            {hasBlend ? (
              <div className="rounded-lg border border-border bg-card/50 p-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Linked style
                </span>
                <p className="mt-1 font-mono text-xs text-accent">{blend!.styleTag}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card/30 p-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  No blend linked
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Run a Band Blend first to inherit a style automatically, or paste a Suno style
                  prompt below to use it directly.
                </p>
                <Textarea
                  className="mt-2 min-h-[64px] border-border bg-card/60 font-mono text-xs"
                  placeholder="Paste a Suno style prompt here, e.g. trip-hop, dark, 80bpm, orchestral samples…"
                  value={manualStyle}
                  onChange={(e) => set({ manualStyle: e.target.value })}
                />
              </div>
            )}

            <LengthPlanner
              structure={value.structure ?? ""}
              onStructure={(text) => set({ structure: text })}
            />

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5">
              <div>
                <span className="block text-xs font-medium text-foreground/90">Structure only</span>
                <span className="block text-[10px] text-muted-foreground">
                  Generate section tags and cues — I&apos;ll write the words myself.
                </span>
              </div>
              <Switch
                checked={tagsOnly}
                onCheckedChange={(v) => onChange({ ...value, tagsOnly: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
              <div>
                <span className="block text-xs font-medium text-foreground/90">Instrumental intro</span>
                <span className="block text-[10px] text-muted-foreground">
                  Open with a few bars of band before the first line, instead of starting on the vocal.
                </span>
              </div>
              <Switch
                checked={value.instrumentalIntro === true}
                onCheckedChange={(v) => onChange({ ...value, instrumentalIntro: v })}
              />
            </label>
            </div>
          </details>

          <details className="group rounded-lg border border-border bg-card/30">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="flex-1">
                <span className="block text-sm font-medium">Punctuation Suno performs</span>
                <span className="block text-xs text-muted-foreground">
                  Small marks in a line change how it&apos;s sung.
                </span>
              </span>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-1.5 px-3 pb-3">
              {LYRIC_NOTATION.map((n) => (
                <li key={n.mark} className="flex gap-3 text-xs">
                  <span className="w-16 shrink-0 font-mono text-accent">{n.mark}</span>
                  <span className="text-muted-foreground">{n.effect}</span>
                </li>
              ))}
              <li className="pt-1 text-[11px] text-muted-foreground">
                Suno treats these as hints, not commands. Use one or two per section.
              </li>
            </ul>
          </details>

          <Button
            onClick={() => void generate()}
            disabled={loading}
            className="glow-primary h-11 w-full gap-2 font-display tracking-wide"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {loading
              ? tagsOnly
                ? "Building structure…"
                : "Forging hooks and verses…"
              : tagsOnly
                ? "Build Structure"
                : "Forge Lyrics"}
          </Button>
        </div>
      </Panel>
      </div>

      <div className="min-w-0 space-y-5">
      {sections.length && renderTakeCheck ? renderTakeCheck({ highlight: justCopied }) : null}
      <Panel
        title="Lyric Sheet"
        subtitle={title || "Section tags, per-line lock, rewrite and undo."}
        action={
          sections.length ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={showRhymes}
                onClick={() => set({ showRhymes: !showRhymes })}
                className={cn("gap-1.5 text-xs", showRhymes && "border-primary/60 text-primary")}
              >
                <Rows3 className="size-3.5" /> {showRhymes ? "Hide rhyme scheme" : "Rhyme scheme"}
              </Button>
              <CopyButton value={exportLyrics(composeSunoLyrics(sections), value.cleanEnding !== false).text} label="Copy for Suno" onCopied={() => setJustCopied(true)} />
            </div>
          ) : undefined
        }
      >
        {sections.length ? (
          <div className="space-y-4">
            {trapCount ? (
              <div className="flex flex-wrap items-start gap-2 rounded-lg border border-signal-mid/50 bg-signal-mid/10 px-3 py-2 text-xs">
                <p className="min-w-0 flex-1 leading-relaxed">
                  <span className="font-medium">Rhyme trap in {trapCount} section{trapCount > 1 ? "s" : ""}:</span> almost
                  every line ends on a clean one-syllable rhyme, which sounds like poetry written to a meter.
                  Use &quot;Loosen rhymes&quot; on that section, or set Rhyme to &quot;Loose&quot; or &quot;Barely rhymes&quot; and regenerate.
                </p>
                {!showRhymes ? (
                  <button type="button" onClick={() => set({ showRhymes: true })} className="text-primary underline">
                    Show rhyme scheme
                  </button>
                ) : null}
              </div>
            ) : null}
            {sections.map((s, si) => (
              <div key={si} className="rounded-lg border border-border bg-card/60">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{s.tag}</span>
                    {showRhymes && rhymeInfo[si]?.scheme.length ? (
                      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title="Rhyme scheme: lines with the same letter rhyme">
                        {rhymeInfo[si]!.scheme}
                      </span>
                    ) : null}
                    {rhymeInfo[si]?.trap ? (
                      <span className="rounded border border-signal-mid/60 px-1.5 py-0.5 text-[10px] text-signal-mid">Rhyme trap</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {rhymeInfo[si]?.trap ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy === `s-${si}`}
                        onClick={() => void regenSection(si, { loosenRhymes: true })}
                        className="h-7 px-2 text-[11px]"
                        title="Rewrite the line endings so they don't all rhyme perfectly. Locked lines stay."
                      >
                        Loosen rhymes
                      </Button>
                    ) : null}
                    {s.lines.length ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy === `s-${si}`}
                        onClick={() => void regenSection(si)}
                        className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-primary"
                      >
                        <RefreshCw
                          className={cn("size-3.5", busy === `s-${si}` && "animate-spin")}
                        />
                        <span className="hidden sm:inline">Regenerate section</span>
                      </Button>
                    ) : null}
                    <CopyButton value={composeSunoLyrics([s])} size="icon" />
                    <button
                      type="button"
                      onClick={() => removeSection(si)}
                      title="Remove section"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    Cue
                  </span>
                  <input
                    value={s.cue ?? ""}
                    onChange={(e) => setCue(si, e.target.value)}
                    placeholder="Whispered, sparse  (Suno reads this as [cue])"
                    className="min-w-0 flex-1 bg-transparent py-1 text-xs text-accent italic outline-none placeholder:text-muted-foreground/60 placeholder:not-italic"
                  />
                </div>
                {s.lines.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    Instrumental section — no lyrics. Suno plays it from the tag and cue.
                  </p>
                ) : null}
                <ul className="divide-y divide-border/60">
                  {s.lines.map((l, li) => (
                    <li
                      key={li}
                      className={cn(
                        "group flex flex-wrap items-center gap-1 px-2 py-1.5 transition-colors sm:gap-2 sm:px-3",
                        l.locked ? "bg-primary/5" : "hover:bg-secondary/40",
                      )}
                    >
                      <input
                        value={l.text}
                        onChange={(e) => editLine(si, li, e.target.value)}
                        readOnly={l.locked}
                        className={cn(
                          "w-full min-w-0 flex-1 basis-full bg-transparent py-1 text-sm outline-none sm:basis-auto",
                          l.locked ? "text-primary" : "text-foreground",
                        )}
                      />
                      <div className="ml-auto flex items-center">
                        {showRhymes && rhymeInfo[si]?.lines[li]?.letter ? (
                          <RhymeBadge info={rhymeInfo[si]!.lines[li]!} />
                        ) : null}
                        <LineMarkers
                          text={l.text}
                          locked={l.locked}
                          all={s.lines.map((x) => x.text)}
                          index={li}
                          banned={banned}
                        />
                        <button
                          type="button"
                          onClick={() => toggleLock(si, li)}
                          title={l.locked ? "Unlock line" : "Lock line"}
                          className={cn(
                            "rounded p-1.5 transition-colors",
                            l.locked
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {l.locked ? (
                            <Lock className="size-3.5" />
                          ) : (
                            <LockOpen className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void regenLine(si, li)}
                          disabled={l.locked || busy === `${si}-${li}`}
                          title="Regenerate line"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-accent disabled:opacity-25"
                        >
                          <RefreshCw
                            className={cn("size-3.5", busy === `${si}-${li}` && "animate-spin")}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => undoLine(si, li)}
                          disabled={l.previous === undefined}
                          title="Undo last rewrite"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-20"
                        >
                          <Undo2 className="size-3.5" />
                        </button>
                        <CopyButton value={l.text} size="icon" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Add section
              </span>
              {QUICK_SECTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addSection(t)}
                  className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                >
                  <Plus className="size-3" />
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 text-center">
            <Wand2 className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Lyrics arrive split into [Verse 1], [Pre-Chorus], [Chorus] and more — every line gets
              a lock toggle, a one-click rewrite and an undo.
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Good subject: "the last shift before a diner closes for good". Weak subject: "love and
              loss".
            </p>
          </div>
        )}
      </Panel>
      </div>
    </div>
  );
}

const LETTER_COLORS = ["text-sky-300", "text-amber-300", "text-emerald-300", "text-fuchsia-300", "text-orange-300", "text-teal-300"];

/** The line's rhyme letter; perfect one-syllable rhymes are underlined, the trap's raw material. */
function RhymeBadge({ info }: { info: LineRhyme }) {
  const color = LETTER_COLORS[(info.letter.charCodeAt(0) - 65) % LETTER_COLORS.length];
  const what =
    info.kind === "perfect"
      ? `perfect rhyme${info.oneSyllable ? ", one syllable" : ""}`
      : info.kind === "near"
        ? "loose rhyme"
        : info.kind === "repeat"
          ? "same word repeated"
          : "no rhyme above";
  return (
    <span
      title={`"${info.word}": ${what}`}
      className={cn(
        "mr-1 w-5 text-center font-mono text-[11px] font-semibold",
        color,
        info.kind === "perfect" && info.oneSyllable && "underline decoration-2 underline-offset-2",
      )}
    >
      {info.letter}
    </span>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; hint: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs transition-colors",
              value === o.value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {current ? <p className="mt-1.5 text-[11px] text-muted-foreground">{current.hint}</p> : null}
    </div>
  );
}
