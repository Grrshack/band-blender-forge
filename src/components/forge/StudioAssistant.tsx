import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, MessageSquare, Send, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { runForge } from "@/lib/forge.functions";
import { useSettings } from "./settings";
import type { BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setError(null);
    setBusy(true);

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
              artist_1: currentBlend.artists[0] ?? "",
              artist_2: currentBlend.artists[1] ?? "",
              artist_3: currentBlend.artists[2] ?? "",
              target_genre: currentBlend.targetGenre,
              era: currentBlend.targetEra,
              energy: currentBlend.sliders.energy,
              complexity: currentBlend.sliders.complexity,
              brightness: currentBlend.sliders.brightness,
            },
            history,
          },
        },
      });
      const parsed = JSON.parse(res.json) as IntentResponse;
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
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed top-1/2 right-0 z-50 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-border bg-panel/95 px-2.5 py-3 font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground",
          open && "hidden",
        )}
        aria-label="Open studio assistant"
      >
        <Bot className="size-4 text-primary" />
        <span className="[writing-mode:vertical-rl] rotate-180">Assistant</span>
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
      </button>

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-dvh w-full max-w-[380px] flex-col border-l border-border bg-panel/95 backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="glow-primary flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <Bot className="size-4 text-primary" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold tracking-tight">Studio Assistant</h2>
              <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                Natural language control
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Auto-run toggle */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-accent" />
            Auto-run blend on apply
          </label>
          <Switch checked={autoRun} onCheckedChange={onToggleAutoRun} />
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
        <div className="border-t border-border px-4 pt-3">
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
        <div className="flex gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Describe a sound or tweak the blend…"
            disabled={busy}
            className="h-10 border-border bg-card/60 text-sm focus-visible:ring-primary"
          />
          <Button
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            size="sm"
            className="glow-primary h-10 shrink-0 gap-1.5"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </div>
      </aside>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
