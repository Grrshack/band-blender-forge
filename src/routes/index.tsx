import { createFileRoute } from "@tanstack/react-router";
import {
  AudioLines,
  AudioWaveform,
  BarChart2,
  BookMarked,
  Gauge,
  Map,
  Rocket,
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
import { GuidedFlow } from "@/components/forge/GuidedFlow";
import { HonestFeedback } from "@/components/forge/HonestFeedback";
import { LyricForge } from "@/components/forge/LyricForge";
import { MasteringLab } from "@/components/forge/MasteringLab";
import { PromptLibrary } from "@/components/forge/PromptLibrary";
import { ReleaseDossier } from "@/components/forge/ReleaseDossier";
import { GenreGuide } from "@/components/forge/GenreGuide";
import { UsageDashboard } from "@/components/forge/UsageDashboard";
import { SettingsProvider } from "@/components/forge/settings";
import { SharedView } from "@/components/forge/SharedView";
import { SunoSheet } from "@/components/forge/SunoSheet";
import { SystemPanel } from "@/components/forge/SystemPanel";
import { emptyState, type ForgeState } from "@/components/forge/types";
import { WorkspaceBar } from "@/components/forge/WorkspaceBar";
import { Toaster } from "@/components/ui/sonner";
import { getSharedBlend } from "@/lib/forge.functions";
import type { BlendResult } from "@/components/forge/types";
import { toast } from "sonner";
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
  { value: "blend",    label: "Band Blender",    icon: Sliders },
  { value: "lyrics",   label: "Lyric Forge",     icon: Wand2 },
  { value: "suno",     label: "Export Sheet",    icon: Send },
  { value: "dossier",  label: "Release Dossier", icon: Rocket },
  { value: "fix",      label: "Fix a Take",      icon: Stethoscope },
  { value: "compare",  label: "Comparables",     icon: Search },
  { value: "feedback", label: "Honest Feedback", icon: Gauge },
  { value: "master",   label: "Mastering",       icon: AudioWaveform },
  { value: "library",  label: "Prompt Library",  icon: BookMarked },
  { value: "genres",   label: "Genre Guides",    icon: Map },
  { value: "usage",    label: "Usage",           icon: BarChart2 },
];

function Index() {
  const [tab, setTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p && TABS.some((t) => t.value === p)) return p;
    } catch { /* SSR */ }
    return "blend";
  });
  const [state, setState] = useState<ForgeState>(emptyState);
  const [shared, setShared] = useState<SharePayload | null>(null);
  const [mode, setMode] = useState<"guided" | "rack">("rack");

  useEffect(() => {
    try {
      const m = localStorage.getItem("blf.mode");
      if (m === "guided" || m === "rack") setMode(m);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeMode = (m: "guided" | "rack") => {
    setMode(m);
    try {
      localStorage.setItem("blf.mode", m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("remix");
    if (!slug) return;
    void getSharedBlend({ data: { slug } })
      .then((row) => {
        setState((prev) => ({
          ...prev,
          blend: {
            ...prev.blend,
            lookupMode: "band",
            artists: [...(row.artists ?? []), "", "", ""].slice(0, 3),
            result: row.blend_data as BlendResult,
          },
        }));
        setTab("blend");
        toast.success("Blend remixed into your studio — tweak it and make it yours.");
      })
      .catch(() => toast.error("That blend couldn't be loaded."))
      .finally(() => window.history.replaceState(null, "", window.location.pathname));
  }, []);

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
            onRemix={() => {
              setState((prev) => ({
                ...prev,
                blend: {
                  ...prev.blend,
                  result: {
                    ...(prev.blend.result ?? {}),
                    styleTag: shared.style,
                    excludeStyles: shared.exclude,
                  },
                },
                lyrics: {
                  ...prev.lyrics,
                  title: shared.title,
                  manualStyle: shared.style,
                  sections: shared.lyrics
                    .split(/\n\s*\n/)
                    .map((block) => {
                      const rows = block.split("\n").filter((r) => r.trim());
                      const tag = /^\[.*\]$/.test(rows[0] ?? "") ? rows.shift()! : "[Section]";
                      return { tag, lines: rows.map((text) => ({ text, locked: false })) };
                    })
                    .filter((sec) => sec.lines.length || sec.tag !== "[Section]"),
                },
              }));
              window.history.replaceState(null, "", window.location.pathname);
              setShared(null);
              setTab("lyrics");
              toast.success("Remixed into your studio.");
            }}
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

  const activeTab = TABS.find((t) => t.value === tab);

  return (
    <AuthProvider>
      <SettingsProvider>
        <div className="flex min-h-screen bg-background">

          {/* ── Left Sidebar ── */}
          <aside className="w-56 flex-shrink-0 sticky top-0 h-screen flex flex-col border-r border-border bg-panel/40 overflow-y-auto">

            {/* Logo */}
            <div className="px-4 pt-6 pb-5 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="glow-primary flex size-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                  <AudioLines className="size-4 text-primary" />
                </span>
                <div>
                  <div className="neon-text font-display text-sm font-bold tracking-tight leading-snug">
                    Band Forge
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase mt-0.5">
                    Music Console
                  </div>
                </div>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="px-3 py-3 border-b border-border/60">
              <div className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground/50 uppercase mb-2 px-1">
                Studio Mode
              </div>
              <div
                role="radiogroup"
                aria-label="Studio mode"
                className="flex rounded-lg border border-border bg-background/50 p-0.5"
              >
                {(
                  [
                    ["guided", "Guided"],
                    ["rack",   "Full rack"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => changeMode(m)}
                    className={
                      "flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors " +
                      (mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-2 py-3">
              <div className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground/40 uppercase mb-1.5 px-2">
                Tools
              </div>
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTab(t.value);
                    if (mode === "guided") changeMode("rack");
                  }}
                  className={
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors " +
                    (tab === t.value && mode === "rack"
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40 font-normal")
                  }
                >
                  <t.icon className="size-3.5 flex-shrink-0" />
                  <span className="text-sm">{t.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Right Content Panel ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Top bar */}
            <div className="border-b border-border bg-background/80 backdrop-blur px-6 py-3 flex-shrink-0">
              <WorkspaceBar state={state} onLoadState={setState} />
            </div>

            {/* Tool content */}
            <main className="flex-1 overflow-y-auto">
              <div className="px-6 py-6">

                {/* Page title */}
                <div className="mb-5">
                  <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                    {mode === "guided" ? "Guided Flow" : (activeTab?.label ?? "Studio")}
                  </h1>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-0.5">
                    Band Lookup &amp; Lyric Forge — AI Music Pre-Production
                  </p>
                </div>

                {/* ── Guided Flow ── */}
                {mode === "guided" ? (
                  <GuidedFlow
                    state={state}
                    patch={patch}
                    onExitToRack={() => changeMode("rack")}
                  />
                ) : (
                  /* ── Rack: show active tool directly (no tab bar needed) ── */
                  <>
                    {tab === "blend" && (
                      <BandBlender
                        value={state.blend}
                        onChange={(v) => patch("blend", v)}
                        onSendToForge={() => setTab("lyrics")}
                        onOpenSunoSheet={() => setTab("suno")}
                      />
                    )}
                    {tab === "lyrics" && (
                      <LyricForge
                        value={state.lyrics}
                        onChange={(v) => patch("lyrics", v)}
                        blend={state.blend.result}
                      />
                    )}
                    {tab === "suno" && (
                      <SunoSheet
                        blend={state.blend}
                        lyrics={state.lyrics}
                        onBlend={(v) => patch("blend", v)}
                        onLyrics={(v) => patch("lyrics", v)}
                        onOpenForge={() => setTab("lyrics")}
                      />
                    )}
                    {tab === "dossier" && (
                      <ReleaseDossier
                        blend={state.blend}
                        lyrics={state.lyrics}
                        value={state.dossier}
                        onChange={(v) => patch("dossier", v)}
                      />
                    )}
                    {tab === "fix" && (
                      <FixTake
                        blend={state.blend}
                        lyrics={state.lyrics}
                        value={state.fix}
                        onChange={(v) => patch("fix", v)}
                        onBlend={(v) => patch("blend", v)}
                        takes={state.takes}
                        onTakes={(v) => patch("takes", v)}
                      />
                    )}
                    {tab === "compare" && (
                      <ComparableArtists
                        value={state.compare}
                        onChange={(v) => patch("compare", v)}
                        onSendToBlender={(name) => {
                          const rest = state.blend.artists.filter((a) => a.trim() && a !== name);
                          patch("blend", {
                            ...state.blend,
                            lookupMode: "band",
                            artists: [name, ...rest].slice(0, 3),
                          });
                          setTab("blend");
                        }}
                      />
                    )}
                    {tab === "feedback" && (
                      <HonestFeedback
                        value={state.critique}
                        onChange={(v) => patch("critique", v)}
                        lyrics={state.lyrics}
                      />
                    )}
                    {tab === "master" && <MasteringLab />}
                    {tab === "library" && <PromptLibrary onApply={applyPreset} />}
                    {tab === "genres" && (
                      <GenreGuide
                        onApplyToBlend={(genre) => {
                          patch("blend", { ...state.blend, targetGenre: genre });
                          setTab("blend");
                        }}
                      />
                    )}
                    {tab === "usage" && <UsageDashboard />}
                  </>
                )}
              </div>
            </main>
          </div>
        </div>

        <SystemPanel />
        <Toaster />
      </SettingsProvider>
    </AuthProvider>
  );
}
