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
    // Read ?tab= param on first render so shared genre links land on the right tab.
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

  // ?remix=<slug> loads a community blend into the studio as a starting point.
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

              {/* ── Guided / Rack mode toggle ── */}
              <div
                role="radiogroup"
                aria-label="Studio mode"
                className="flex rounded-lg border border-border bg-panel/70 p-1"
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
                      "rounded-md px-3 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors " +
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
          </header>

          <main className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6">
            <WorkspaceBar state={state} onLoadState={setState} />

            {/* ── Guided Flow (4-step wizard) ── */}
            {mode === "guided" ? (
              <GuidedFlow
                state={state}
                patch={patch}
                onExitToRack={() => changeMode("rack")}
                onExitToFixTake={() => { changeMode("rack"); setTab("fix"); }}
              />
            ) : (
              /* ── Rack Console (left nav + content) ── */
              <div className="flex gap-5 lg:items-start">
                {/* Left sidebar nav — desktop only */}
                <nav className="hidden lg:flex w-48 shrink-0 flex-col gap-0.5 rounded-xl border border-border bg-panel/70 p-1.5 sticky top-4 self-start">
                  {TABS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTab(t.value)}
                      className={
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-[11px] tracking-[0.14em] uppercase text-left transition-colors " +
                        (tab === t.value
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                      }
                    >
                      <t.icon className="size-3.5 shrink-0" />
                      {t.label}
                    </button>
                  ))}
                </nav>

                <div className="min-w-0 flex-1">
                  {/* Horizontal strip — mobile only */}
                  <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-panel/70 p-1 lg:hidden">
                    {TABS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTab(t.value)}
                        className={
                          "flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors " +
                          (tab === t.value
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                        }
                      >
                        <t.icon className="size-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content — conditional rendering */}
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
                </div>
              </div>
            )}
          </main>

          <SystemPanel />
          <Toaster />
        </div>
      </SettingsProvider>
    </AuthProvider>
  );
}
