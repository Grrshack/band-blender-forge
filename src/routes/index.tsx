import { createFileRoute } from "@tanstack/react-router";
import {
  AudioLines,
  AudioWaveform,
  BookMarked,
  Gauge,
  Search,
  Send,
  Sliders,
  Stethoscope,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AuthProvider } from "@/components/forge/auth";
import { BandBlender } from "@/components/forge/BandBlender";
import { ComparableArtists } from "@/components/forge/ComparableArtists";
import { FixTake } from "@/components/forge/FixTake";
import { HonestFeedback } from "@/components/forge/HonestFeedback";
import { LyricForge } from "@/components/forge/LyricForge";
import { MasteringLab } from "@/components/forge/MasteringLab";
import { PromptLibrary } from "@/components/forge/PromptLibrary";
import { SettingsProvider } from "@/components/forge/settings";
import { SharedView } from "@/components/forge/SharedView";
import { SunoSheet } from "@/components/forge/SunoSheet";
import { SystemPanel } from "@/components/forge/SystemPanel";
import { emptyState, type ForgeState } from "@/components/forge/types";
import { WorkspaceBar } from "@/components/forge/WorkspaceBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { decodeShare, tokenFromHash, type SharePayload } from "@/lib/share";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Band Lookup & Lyric Forge — AI Music Pre-Production" },
      {
        name: "description",
        content:
          "Blend artists into one style, forge hook-first lyrics with per-line control, get blunt song critique and save every session.",
      },
      { property: "og:title", content: "Band Lookup & Lyric Forge" },
      {
        property: "og:description",
        content:
          "A studio console for AI music pre-production: style blending, lyric forging, comparable artists, honest feedback and a prompt library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { value: "blend", label: "Band Blender", icon: Sliders, desc: "Blend 1–3 artists into one producible style, tuned by energy, complexity and brightness." },
  { value: "lyrics", label: "Lyric Forge", icon: Wand2, desc: "Forge hook-first lyrics section by section, with per-line lock and regeneration." },
  { value: "suno", label: "Suno Sheet", icon: Send, desc: "Assemble the full prompt sheet, ready to paste straight into Suno." },
  { value: "fix", label: "Fix a Take", icon: Stethoscope, desc: "Log real takes and tighten the prompt from what the model actually returned." },
  { value: "compare", label: "Comparables", icon: Search, desc: "Drop in lyrics or style tags and find adjacent artists, with reasoning." },
  { value: "feedback", label: "Honest Feedback", icon: Gauge, desc: "Blunt critique on lyrics and notes — scores, clichés and the three fixes that matter." },
  { value: "master", label: "Mastering", icon: AudioWaveform, desc: "Plan the chain before you render — loudness targets, spectrum and references." },
  { value: "library", label: "Prompt Library", icon: BookMarked, desc: "Reusable prompt presets with search and tags, ready to apply to any session." },
];

function Equalizer() {
  const bars = [0.35, 0.7, 0.5, 0.9, 0.6, 0.85, 0.4, 0.75, 0.55, 0.95, 0.45, 0.8];
  return (
    <div aria-hidden className="hidden items-end gap-1 sm:flex">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1 origin-bottom animate-eq rounded-full bg-gradient-to-t from-primary/50 to-accent/80"
          style={{
            height: `${h * 28}px`,
            animationDelay: `${i * 0.11}s`,
            animationDuration: `${1 + (i % 4) * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

function Index() {
  const [tab, setTab] = useState("blend");
  const [state, setState] = useState<ForgeState>(emptyState);
  const [shared, setShared] = useState<SharePayload | null>(null);

  // A link like /#share=... opens a read-only view. The data lives in the link itself.
  useEffect(() => {
    const read = () => {
      const token = tokenFromHash(window.location.hash);
      if (!token) return;
      void decodeShare(token).then((p) => {
        if (p) setShared(p);
      });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const patch = <K extends keyof ForgeState>(key: K, value: ForgeState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const applyPreset = (kind: string, body: string) => {
    if (kind === "style") {
      patch("compare", { ...state.compare, tags: body });
      setState((prev) => ({
        ...prev,
        lyrics: {
          ...prev.lyrics,
          notes: [prev.lyrics.notes, `Style: ${body}`].filter(Boolean).join("\n"),
        },
      }));
    } else {
      setState((prev) => ({
        ...prev,
        lyrics: {
          ...prev.lyrics,
          notes: [prev.lyrics.notes, body].filter(Boolean).join("\n"),
        },
      }));
    }
    setTab("lyrics");
  };

  if (shared) {
    return (
      <AuthProvider>
        <SettingsProvider>
          <SharedView
            payload={shared}
            onClose={() => {
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
              setShared(null);
            }}
          />
          <Toaster />
        </SettingsProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <div className="min-h-screen pb-24">
          <header className="mx-auto max-w-7xl px-4 pt-8 pb-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="glow-primary relative flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                  <AudioLines className="size-6 text-primary" />
                </span>
                <div>
                  <h1 className="neon-text font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    Band Lookup &amp; Lyric Forge
                  </h1>
                  <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                    Pre-production console for AI music generation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden flex-col items-end gap-1.5 sm:flex">
                  <span className="rounded-full border border-border bg-card/50 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    08 modules live
                  </span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-accent uppercase">
                    AI ready
                  </span>
                </div>
                <Equalizer />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6">
            <WorkspaceBar state={state} onLoadState={setState} />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5 h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border bg-panel/70 p-1">
                {TABS.map((t, i) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="group gap-2 rounded-lg px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4"
                  >
                    <span className="font-mono text-[9px] text-muted-foreground/50 group-data-[state=active]:text-primary/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <t.icon className="size-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="blend" className="mt-0">
                <BandBlender
                  value={state.blend}
                  onChange={(v) => patch("blend", v)}
                  onSendToForge={() => setTab("lyrics")}
                  onOpenSunoSheet={() => setTab("suno")}
                />
              </TabsContent>
              <TabsContent value="lyrics" className="mt-0">
                <LyricForge
                  value={state.lyrics}
                  onChange={(v) => patch("lyrics", v)}
                  blend={state.blend.result}
                />
              </TabsContent>
              <TabsContent value="suno" className="mt-0">
                <SunoSheet
                  blend={state.blend}
                  lyrics={state.lyrics}
                  onBlend={(v) => patch("blend", v)}
                  onLyrics={(v) => patch("lyrics", v)}
                  onOpenForge={() => setTab("lyrics")}
                />
              </TabsContent>
              <TabsContent value="fix" className="mt-0">
                <FixTake
                  blend={state.blend}
                  lyrics={state.lyrics}
                  value={state.fix}
                  onChange={(v) => patch("fix", v)}
                  onBlend={(v) => patch("blend", v)}
                  takes={state.takes}
                  onTakes={(v) => patch("takes", v)}
                />
              </TabsContent>
              <TabsContent value="compare" className="mt-0">
                <ComparableArtists value={state.compare} onChange={(v) => patch("compare", v)} />
              </TabsContent>
              <TabsContent value="feedback" className="mt-0">
                <HonestFeedback
                  value={state.critique}
                  onChange={(v) => patch("critique", v)}
                  lyrics={state.lyrics}
                />
              </TabsContent>
              <TabsContent value="master" className="mt-0">
                <MasteringLab />
              </TabsContent>
              <TabsContent value="library" className="mt-0">
                <PromptLibrary onApply={applyPreset} />
              </TabsContent>
            </Tabs>

            <section className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-mono text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
                  The full rack
                </h2>
                <span className="hairline-top h-px flex-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TABS.map((t, i) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTab(t.value)}
                    className={cn(
                      "panel-surface group p-4 text-left transition-all hover:border-primary/50 hover:glow-primary",
                      tab === t.value && "border-primary/60 glow-primary",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card/60 transition-colors group-hover:border-primary/40">
                        <t.icon className="size-4 text-primary transition-colors group-hover:text-accent" />
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-3 font-display text-sm font-semibold tracking-tight">{t.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </section>
          </main>

          <SystemPanel />
          <Toaster />
        </div>
      </SettingsProvider>
    </AuthProvider>
  );
}
