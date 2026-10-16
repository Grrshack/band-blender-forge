import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Send, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { runForge } from "@/lib/forge.functions";
import { ERA_OPTIONS } from "@/lib/suno";
import { useSettings } from "./settings";
import { Panel } from "./Field";
import type { BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

const VALID_ERAS = new Set(ERA_OPTIONS.map((e) => e.value));

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
}: {
  currentBlend: BlendSlice;
  onApply: (intent: IntentResponse) => void;
  autoRun: boolean;
  onToggleAutoRun: (v: boolean) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
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
      <Panel
        title="Studio Assistant"
        subtitle="Describe a sound in plain English — the assistant sets up the Band Blender for you automatically."
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
          className="mb-4 max-h-[420px] min-h-[200px] space-y-3 overflow-y-auto rounded-lg border border-border bg-card/30 p-4"
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
