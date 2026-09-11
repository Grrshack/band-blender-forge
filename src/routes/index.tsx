import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, BookMarked, Gauge, Search, Sliders, Wand2 } from "lucide-react";
import { useState } from "react";

import { AuthProvider } from "@/components/forge/auth";
import { BandBlender } from "@/components/forge/BandBlender";
import { ComparableArtists } from "@/components/forge/ComparableArtists";
import { HonestFeedback } from "@/components/forge/HonestFeedback";
import { LyricForge } from "@/components/forge/LyricForge";
import { PromptLibrary } from "@/components/forge/PromptLibrary";
import { SettingsProvider } from "@/components/forge/settings";
import { SystemPanel } from "@/components/forge/SystemPanel";
import { emptyState, type ForgeState } from "@/components/forge/types";
import { WorkspaceBar } from "@/components/forge/WorkspaceBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

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
  { value: "blend", label: "Band Blender", icon: Sliders },
  { value: "lyrics", label: "Lyric Forge", icon: Wand2 },
  { value: "compare", label: "Comparables", icon: Search },
  { value: "feedback", label: "Honest Feedback", icon: Gauge },
  { value: "library", label: "Prompt Library", icon: BookMarked },
];

function Index() {
  const [tab, setTab] = useState("blend");
  const [state, setState] = useState<ForgeState>(emptyState);

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

  return (
    <AuthProvider>
      <SettingsProvider>
        <div className="min-h-screen pb-24">
          <header className="mx-auto max-w-7xl px-4 pt-8 pb-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="glow-primary flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                  <AudioLines className="size-5 text-primary" />
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
            </div>
          </header>

          <main className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6">
            <WorkspaceBar state={state} onLoadState={setState} />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5 h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border bg-panel/70 p-1">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="gap-2 rounded-lg px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4"
                  >
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
                />
              </TabsContent>
              <TabsContent value="lyrics" className="mt-0">
                <LyricForge
                  value={state.lyrics}
                  onChange={(v) => patch("lyrics", v)}
                  blend={state.blend.result}
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
              <TabsContent value="library" className="mt-0">
                <PromptLibrary onApply={applyPreset} />
              </TabsContent>
            </Tabs>
          </main>

          <SystemPanel />
          <Toaster />
        </div>
      </SettingsProvider>
    </AuthProvider>
  );
}
