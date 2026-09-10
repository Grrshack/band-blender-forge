import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, Search, Sliders, Wand2 } from "lucide-react";
import { useState } from "react";

import { BandBlender, type BlendResult } from "@/components/forge/BandBlender";
import { ComparableArtists } from "@/components/forge/ComparableArtists";
import { LyricForge } from "@/components/forge/LyricForge";
import { SettingsProvider } from "@/components/forge/settings";
import { SystemPanel } from "@/components/forge/SystemPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Band Lookup & Lyric Forge — AI Music Pre-Production" },
      {
        name: "description",
        content:
          "Blend artists into one style, forge hook-first lyrics with per-line control, and reverse-lookup comparable artists for AI music generation.",
      },
      { property: "og:title", content: "Band Lookup & Lyric Forge" },
      {
        property: "og:description",
        content:
          "A cyberpunk studio console for AI music pre-production: style blending, lyric forging, and comparable-artist lookup.",
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
];

function Index() {
  const [tab, setTab] = useState("blend");
  const [blend, setBlend] = useState<BlendResult | null>(null);

  return (
    <SettingsProvider>
      <div className="min-h-screen pb-24">
        <header className="mx-auto max-w-7xl px-4 pt-8 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="glow-violet flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
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
            <p className="max-w-sm text-xs text-muted-foreground">
              Stateless by design — everything lives in this tab until you close it.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 sm:px-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-5 h-auto w-full justify-start gap-1 rounded-xl border border-border bg-panel/70 p-1">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="gap-2 rounded-lg px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4"
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="blend" className="mt-0">
              <BandBlender
                onSendToForge={(b) => {
                  setBlend(b);
                  setTab("lyrics");
                }}
              />
            </TabsContent>
            <TabsContent value="lyrics" className="mt-0">
              <LyricForge blend={blend} />
            </TabsContent>
            <TabsContent value="compare" className="mt-0">
              <ComparableArtists />
            </TabsContent>
          </Tabs>
        </main>

        <SystemPanel />
        <Toaster />
      </div>
    </SettingsProvider>
  );
}
