import { AudioWaveform, Drum, Loader2, MessageSquare, PenLine, Send, Sparkles, Stethoscope, Zap, Radar } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ERA_OPTIONS } from "@/lib/suno";
import { useSettings } from "./settings";
import { useForge } from "./use-forge";
import { Panel } from "./Field";
import { BeatStart } from "./BeatStart";
import type { BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { track } from "@/lib/stats";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type IntentResponse = {
  reply: string;
  artist_1: string;
  artist_2: string;
  artist_3: string;
  target_genre: string;
  era: string;
  energy: number;
  complexity: number;
  brightness: number;
};

const VALID_ERAS = new Set<string>(ERA_OPTIONS.map((e) => e.value));

const clampSlider = (v: unknown): number => {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

function sanitizeIntent(raw: unknown): IntentResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (k: string): string =>
    typeof r[k] === "string" ? (r[k] as string).trim() : "";
  const era = str("era");
  return {
    reply: str("reply") || "Done — I've updated the blend settings.",
    artist_1: str("artist_1"),
    artist_2: str("artist_2"),
    artist_3: str("artist_3"),
    target_genre: str("target_genre"),
    era: VALID_ERAS.has(era) ? era : "",
    energy: clampSlider(r["energy"]),
    complexity: clampSlider(r["complexity"]),
    brightness: clampSlider(r["brightness"]),
  };
}

const QUICK_STARTS = [
  "90s grunge meets retro synthwave",
  "Modern lo-fi with Pink Floyd space rock vibes",
  "Heavy metal mixed with ambient cyberpunk",
];

export function StudioAssistant({
  currentBlend,
  onApply,
  autoRun,
  onToggleAutoRun,
  onGoTab,
  onFixSong,
  onAddToStyle,
  initialMessage,
  onInitialMessageSent,
}: {
  /** Text typed on the landing page. Sent once if a key is ready, otherwise left in the box. */
  initialMessage?: string | null | undefined;
  onInitialMessageSent?: (() => void) | undefined;
  onGoTab: (tab: string) => void;
  onFixSong: (notes: string) => void;
  onAddToStyle?: (line: string) => void;
  currentBlend: BlendSlice;
  onApply: (intent: IntentResponse) => void;
  autoRun: boolean;
  onToggleAutoRun: (v: boolean) => void;
}) {
  const forge = useForge();
  const { apiKey, routing, aiReady, loaded, openKeyDialog } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Studio assistant online. Tell me what sound you're after — artists, genres, moods, an era — and I'll set up the Band Blender for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ref mirrors currentBlend so the async send closure always sees the latest values.
  const blendRef = useRef(currentBlend);
  useEffect(() => {
    blendRef.current = currentBlend;
  }, [currentBlend]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Landing-page handoff: run it straight away when AI is ready; otherwise keep the
  // text in the box and ask for a key, so nothing the visitor typed is lost.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!initialMessage || startedRef.current || !loaded) return;
    startedRef.current = true;
    onInitialMessageSent?.();
    // The chat sits below the "What do you want to do?" cards, so bring it into view.
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    if (aiReady) {
      void send(initialMessage);
    } else {
      setInput(initialMessage);
      openKeyDialog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, loaded, aiReady]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setError(null);
    setBusy(true);

    const blend = blendRef.current;
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const res = await forge({
        data: {
          task: "intent",
          routing,
          apiKey,
          payload: {
            message: trimmed,
            current: {
              artist_1: blend.artists[0] ?? "",
              artist_2: blend.artists[1] ?? "",
              artist_3: blend.artists[2] ?? "",
              target_genre: blend.targetGenre,
              era: blend.targetEra,
              energy: blend.sliders.energy,
              complexity: blend.sliders.complexity,
              brightness: blend.sliders.brightness,
            },
            history,
          },
        },
      });
      const parsed = sanitizeIntent(JSON.parse(res.json));
      setMessages((prev) => [...prev, { role: "assistant", text: parsed.reply }]);
      onApply(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The assistant couldn't process that.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Sorry, I hit a snag: ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <StartPaths onGoTab={onGoTab} onFixSong={onFixSong} onAddToStyle={onAddToStyle} />
      <Panel
        title="Describe the sound you want"
        subtitle="Plain English is fine. The assistant sets up the Band Blender for you."
        action={
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-accent" />
            Auto-run blend
            <Switch checked={autoRun} onCheckedChange={onToggleAutoRun} />
          </label>
        }
      >
        {/* Chat messages */}
        <div
          ref={scrollRef}
          className="mb-4 max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-border bg-card/30 p-4"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2.5",
                m.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  m.role === "user"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                {m.role === "user" ? (
                  <MessageSquare className="size-3" />
                ) : (
                  <Sparkles className="size-3" />
                )}
              </span>
              <p
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "border-accent/30 bg-accent/5 text-foreground"
                    : "border-border bg-card/60 text-foreground/90",
                )}
              >
                {m.text}
              </p>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Interpreting…
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Quick-start chips */}
        <div className="mb-4">
          <span className="mb-2 block font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
            Quick starts
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_STARTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void send(q)}
                className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Describe a sound or tweak the blend… e.g. 'Make it darker and more aggressive'"
            disabled={busy}
            rows={2}
            className="min-h-[44px] resize-none border-border bg-card/60 text-sm focus-visible:ring-primary"
          />
          <Button
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            size="sm"
            className="glow-primary h-11 shrink-0 gap-1.5 self-end"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </Panel>
    </div>
  );
}

const PATHS = [
  {
    id: "new",
    icon: Sparkles,
    title: "Start a new song",
    body: "Describe the sound below, or blend up to three artists yourself.",
    tab: "blend",
  },
  {
    id: "fix",
    icon: Stethoscope,
    title: "Fix a song Suno made",
    body: "Tell us what's wrong, add the audio file, and get the quickest fix.",
    tab: "fix",
  },
  {
    id: "lyrics",
    icon: PenLine,
    title: "Write or improve lyrics",
    body: "Hook-first lyrics with per-line control, or a blunt critique of yours.",
    tab: "lyrics",
  },
  {
    id: "beat",
    icon: Drum,
    title: "Start from a beat",
    body: "Make a beat with a free tool, then bring it into Suno.",
    tab: "blend",
  },
  {
    id: "analyze",
    icon: Radar,
    title: "Sound like a song you love",
    body: "Drop the song in. Get its tempo, key and sections, then a Suno prompt in that style.",
    tab: "analyze",
  },
  {
    id: "master",
    icon: AudioWaveform,
    title: "Master a song or stem",
    body: "Clean up the low end, loudness and harshness. Runs in your browser.",
    tab: "master",
  },
] as const;

/** The front door: four plain choices so a new visitor knows where to go. */
function StartPaths({
  onGoTab,
  onFixSong,
  onAddToStyle,
}: {
  onGoTab: (tab: string) => void;
  onFixSong: (notes: string) => void;
  onAddToStyle?: ((line: string) => void) | undefined;
}) {
  const [fixing, setFixing] = useState(false);
  const [beat, setBeat] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <section className="panel-surface p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">What do you want to do?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick one. You can move between tools any time from the menu, or read the{" "}
        <a href="/guides" className="text-primary underline underline-offset-2">
          guides
        </a>
        .
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PATHS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              track("start_choice", p.id);
              return p.id === "fix"
                ? setFixing((v) => !v)
                : p.id === "beat"
                  ? setBeat((v) => !v)
                  : p.id === "new"
                    ? document.getElementById("assistant-input")?.focus()
                    : onGoTab(p.tab);
            }}
            aria-expanded={p.id === "fix" ? fixing : p.id === "beat" ? beat : undefined}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              (p.id === "fix" && fixing) || (p.id === "beat" && beat)
                ? "border-primary/60 bg-primary/10"
                : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/70",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <p.icon className="size-4 text-primary" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{p.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{p.body}</span>
            </span>
          </button>
        ))}
      </div>
      {beat ? <BeatStart onAddToStyle={onAddToStyle} /> : null}
      {fixing ? (
        <div className="mt-4 space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <label htmlFor="fix-notes" className="text-sm font-medium">
            What's wrong with it?
          </label>
          <Textarea
            id="fix-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="The chorus is great but the verses drag, and the vocals sound robotic…"
            className="resize-y bg-card/60 text-sm"
          />
          <Button onClick={() => onFixSong(notes.trim())} className="gap-1.5">
            <Stethoscope className="size-4" /> Continue to Fix a Track
          </Button>
        </div>
      ) : null}
    </section>
  );
}
