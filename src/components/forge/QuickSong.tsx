/**
 * Quick song: the short path for first-timers. One box ("what's your song?") and a vocal
 * choice; three AI steps the studio already uses (Start here's intent → Band Blender → Lyric
 * Forge) run in a row, and the result is a Suno-ready card with Send to Suno. The song lands in
 * the normal studio state as a new song, so "Fine-tune" opens it in the full tools.
 */
import { ArrowRight, Check, Loader2, RotateCcw, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { SendToSuno } from "./SendToSuno";
import { StyleFormatSwitch } from "./StyleFormatSwitch";
import { sanitizeIntent } from "./StudioAssistant";
import { useSettings } from "./settings";
import { emptyState, type BlendResult, type ForgeState } from "./types";
import { useForge } from "./use-forge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sectionsFrom } from "@/lib/lab";
import { checkPrompt } from "@/lib/prompt-checker";
import { arrangeFormats, exportLyrics } from "@/lib/prompt-craft";
import { track } from "@/lib/stats";
import { composeSunoLyrics, vocalString } from "@/lib/suno";
import { sunoPayloadFrom } from "@/lib/suno-payload";
import { cn } from "@/lib/utils";

export type QuickVocal = "any" | "female" | "male" | "instrumental";

const VOCALS: Array<{ value: QuickVocal; label: string }> = [
  { value: "any", label: "Let it choose" },
  { value: "female", label: "Female vocal" },
  { value: "male", label: "Male vocal" },
  { value: "instrumental", label: "Instrumental" },
];

export const QUICK_EXAMPLES = [
  "A moody synth-pop breakup song for a late-night drive, slow build to a big chorus",
  "Upbeat country singalong about a small-town Friday night",
  "Dark, heavy trip-hop about insomnia, whispered verses",
  "Bright 2000s pop-punk anthem about quitting a bad job",
];

const STEPS = ["Picking the sound", "Writing the style", "Writing the lyrics"] as const;

const VOCAL_NOTE: Record<QuickVocal, string> = {
  any: "",
  female: "Lead vocal: female.",
  male: "Lead vocal: male.",
  instrumental: "Instrumental, no vocals.",
};

type Props = {
  state: ForgeState;
  /** Changes to the song after it's made (the Tag list / Studio brief switch). */
  onState: (fn: (prev: ForgeState) => ForgeState) => void;
  onGoTab: (tab: string) => void;
  /** Words from the landing page: fill the box and start straight away. */
  autoStart?: string | null | undefined;
  onAutoStartDone?: (() => void) | undefined;
};

export function QuickSong({ state, onState, onGoTab, autoStart, onAutoStartDone }: Props) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [describe, setDescribe] = useState(state.lyrics.theme || "");
  const [vocal, setVocal] = useState<QuickVocal>("any");
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const hasSong = Boolean(state.blend.result?.styleTag);
  const [view, setView] = useState<"describe" | "result">(hasSong ? "result" : "describe");
  const busy = step >= 0;

  const make = async (text = describe) => {
    const words = text.trim();
    if (!words || busy) return;
    setError(null);
    setDescribe(words);
    track("start_choice", "quick_song");
    const ask = [words, VOCAL_NOTE[vocal]].filter(Boolean).join(" ");
    const prefs = state.blend;
    try {
      // 1. Plain words → artists, genre, era and sliders (what "Start here" does).
      setStep(0);
      const intentRes = await forge({
        data: {
          task: "intent",
          routing,
          apiKey,
          payload: {
            message: ask,
            current: { artist_1: "", artist_2: "", artist_3: "", target_genre: "", era: "", energy: 60, complexity: 50, brightness: 55 },
            history: [],
          },
        },
      });
      const intent = sanitizeIntent(JSON.parse(intentRes.json));
      const artists = [intent.artist_1, intent.artist_2, intent.artist_3].filter(Boolean);
      const sliders = { energy: intent.energy, complexity: intent.complexity, brightness: intent.brightness };

      // 2. The Band Blender style.
      setStep(1);
      const blendRes = await forge({
        data: {
          task: "blend",
          routing,
          apiKey,
          payload: {
            artists,
            sliders,
            sunoVersion: prefs.sunoVersion,
            targetGenre: intent.target_genre,
            genreLock: false,
            targetEra: intent.era,
            promptFormat: prefs.promptFormat ?? "tags",
            ...(vocal === "instrumental" ? { notes: "Instrumental: no vocals." } : {}),
          },
        },
      });
      const result = arrangeFormats(JSON.parse(blendRes.json) as BlendResult, prefs.promptFormat ?? "tags");

      // 3. Lyrics for that style (structure only for an instrumental).
      setStep(2);
      const lyricsRes = await forge({
        data: {
          task: "lyrics",
          routing,
          apiKey,
          payload: {
            theme: words,
            hookIdea: "",
            notes: VOCAL_NOTE[vocal],
            style: {
              styleTag: result.styleTag ?? "",
              genre: result.genre ?? "",
              vocals: result.vocals ?? "",
              mood: result.mood ?? "",
              vocalPrompt: vocalString(result.vocalPrompt),
            },
            bannedWords: [],
            ...(vocal === "instrumental" ? { tagsOnly: true } : {}),
          },
        },
      });
      const out = JSON.parse(lyricsRes.json) as { title?: string; sections?: Array<{ tag?: string; cue?: string; lines?: string[] }> };

      const fresh = emptyState();
      const next: ForgeState = {
        ...fresh,
        blend: {
          ...fresh.blend,
          sunoVersion: prefs.sunoVersion,
          promptFormat: prefs.promptFormat ?? "tags",
          lookupMode: "band",
          artists: [...artists, "", "", ""].slice(0, 3),
          sliders: {
            energy: result.recommendedSliders?.energy ?? sliders.energy,
            complexity: result.recommendedSliders?.complexity ?? sliders.complexity,
            brightness: result.recommendedSliders?.brightness ?? sliders.brightness,
          },
          targetGenre: intent.target_genre,
          targetEra: intent.era,
          result,
          ...(vocal === "female" || vocal === "male" ? { sunoOptions: { vocalGender: vocal } } : {}),
        },
        lyrics: {
          ...fresh.lyrics,
          theme: words,
          title: out.title ?? "",
          sections: sectionsFrom(out),
          tagsOnly: vocal === "instrumental",
        },
      };
      // A new song in the song menu, so whatever was open isn't overwritten.
      window.dispatchEvent(new CustomEvent("bb:new-song", { detail: { state: next, name: out.title || "Quick song" } }));
      setView("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setStep(-1);
    }
  };

  // Words typed on the landing page start a quick song straight away.
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    setDescribe(autoStart);
    setView("describe");
    onAutoStartDone?.();
    void make(autoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Zap className="size-6 text-primary" /> Quick song
        </h2>
        <p className="text-sm text-muted-foreground">
          Say what your song is. You get a Suno style, an exclude list and lyrics, checked and ready to send, in about a minute.
        </p>
      </header>

      {view === "describe" || busy ? (
        <DescribeStep
          describe={describe}
          setDescribe={setDescribe}
          vocal={vocal}
          setVocal={setVocal}
          step={step}
          error={error}
          onMake={() => void make()}
          {...(hasSong && !busy ? { onBack: () => setView("result") } : {})}
        />
      ) : (
        <ResultCard
          state={state}
          onResult={(result) => onState((prev) => ({ ...prev, blend: { ...prev.blend, result } }))}
          onGoTab={onGoTab}
          onAgain={() => void make()}
          onNew={() => {
            setError(null);
            setView("describe");
          }}
          canAgain={Boolean(describe.trim())}
        />
      )}
    </div>
  );
}

function DescribeStep({
  describe,
  setDescribe,
  vocal,
  setVocal,
  step,
  error,
  onMake,
  onBack,
}: {
  describe: string;
  setDescribe: (s: string) => void;
  vocal: QuickVocal;
  setVocal: (v: QuickVocal) => void;
  step: number;
  error: string | null;
  onMake: () => void;
  onBack?: () => void;
}) {
  const busy = step >= 0;
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
      <div className="space-y-1.5">
        <label htmlFor="quick-describe" className="text-sm font-medium">
          What's your song?
        </label>
        <Textarea
          id="quick-describe"
          value={describe}
          onChange={(e) => setDescribe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onMake();
          }}
          rows={3}
          disabled={busy}
          placeholder="The sound, the mood and what it's about. For example: a moody synth-pop breakup song for a late-night drive"
        />
        {!describe.trim() && !busy ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setDescribe(ex)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-1.5" disabled={busy}>
        <legend className="text-sm font-medium">Vocal</legend>
        <div role="radiogroup" aria-label="Vocal" className="flex flex-wrap gap-1.5">
          {VOCALS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={vocal === v.value}
              onClick={() => setVocal(v.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                vocal === v.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>

      {busy ? (
        <ol aria-label="Progress" className="space-y-1.5 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center gap-2", i > step ? "text-muted-foreground" : "")}>
              {i < step ? (
                <Check className="size-4 text-signal-high" />
              ) : i === step ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <span className="inline-block size-4" />
              )}
              {label}
              {i === step ? "…" : ""}
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onMake} disabled={!describe.trim()} className="glow-primary gap-1.5">
            <Sparkles className="size-4" /> Make my song
          </Button>
          {onBack ? (
            <button type="button" onClick={onBack} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Back to my song
            </button>
          ) : null}
          <span className="text-xs text-muted-foreground">Three AI steps on your own key; nothing is sent to Suno until you press Send.</span>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

function ResultCard({
  state,
  onResult,
  onGoTab,
  onAgain,
  onNew,
  canAgain,
}: {
  state: ForgeState;
  onResult: (r: BlendResult) => void;
  onGoTab: (tab: string) => void;
  onAgain: () => void;
  onNew: () => void;
  canAgain: boolean;
}) {
  const r = state.blend.result;
  const payload = useMemo(() => sunoPayloadFrom(state), [state]);
  const lyricsText = useMemo(() => {
    const raw = state.lyrics.sections.length ? composeSunoLyrics(state.lyrics.sections) : "";
    return raw ? exportLyrics(raw, state.lyrics.cleanEnding !== false).text : "";
  }, [state.lyrics]);
  const check = useMemo(
    () =>
      checkPrompt({
        title: payload.title,
        style: payload.style,
        exclude: payload.exclude,
        lyrics: payload.lyrics,
        artists: payload.artists ?? [],
        version: state.blend.sunoVersion,
      }),
    [payload, state.blend.sunoVersion],
  );
  const problems = check.issues.filter((i) => i.level !== "tip").length;
  const artists = state.blend.artists.filter((a) => a.trim());

  if (!r?.styleTag) return null;
  return (
    <section aria-label="Your song" className="space-y-5 rounded-xl border border-primary/30 bg-card/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your song</p>
          <p className="font-display text-xl font-semibold" data-testid="quick-title">
            {state.lyrics.title || "Untitled song"}
          </p>
          {artists.length ? (
            <p className="text-xs text-muted-foreground">
              The sound of {artists.join(" × ")}
              {r.genre ? ` · ${r.genre}` : ""} (names stay out of the prompt)
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            problems ? "border-amber-500/40 text-amber-400" : "border-emerald-500/40 text-emerald-400",
          )}
          title="The same checks as the free Suno Prompt Checker"
        >
          {check.score ?? "–"} · {problems ? `${problems} to check on the Suno Sheet` : "Ready for Suno"}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Style</p>
          <div className="flex items-center gap-2">
            <StyleFormatSwitch result={r} sunoVersion={state.blend.sunoVersion} onResult={onResult} compact />
            <CopyButton value={r.styleTag} label="Copy" />
          </div>
        </div>
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 text-sm" data-testid="quick-style">
          {r.styleTag}
        </p>
      </div>

      {r.excludeStyles ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="min-w-0">
            <span className="font-medium">Exclude:</span> <span className="text-muted-foreground">{r.excludeStyles}</span>
          </p>
          <CopyButton value={r.excludeStyles} label="Copy" />
        </div>
      ) : null}

      {lyricsText ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{state.lyrics.tagsOnly ? "Structure" : "Lyrics"}</p>
            <CopyButton value={lyricsText} label="Copy" />
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed" data-testid="quick-lyrics">
            {lyricsText}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <SendToSuno payload={payload} showStatus />
        <Button variant="outline" size="sm" onClick={onAgain} disabled={!canAgain} className="gap-1.5 text-xs">
          <RotateCcw className="size-3.5" /> Make another version
        </Button>
        <button type="button" onClick={onNew} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          New quick song
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { tab: "blend", label: "Fine-tune the sound", body: "Change artists, energy, era; refine by chat" },
          { tab: "lyrics", label: "Edit the lyrics", body: "Move sections, rewrite lines, lock what you like" },
          { tab: "suno", label: "Suno Sheet", body: "Darker or heavier takes, vocal gender, sliders" },
        ].map((x) => (
          <button
            key={x.tab}
            type="button"
            onClick={() => onGoTab(x.tab)}
            className="group rounded-lg border border-border p-3 text-left hover:border-primary"
          >
            <p className="flex items-center gap-1 text-sm font-medium">
              {x.label} <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="text-xs text-muted-foreground">{x.body}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
