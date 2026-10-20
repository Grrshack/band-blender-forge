import { createFileRoute } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
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
import { StudioAssistant, type IntentResponse } from "@/components/forge/StudioAssistant";
import { SunoSheet } from "@/components/forge/SunoSheet";
import { AiStatusButton } from "@/components/forge/SystemPanel";
import { KeySetupDialog } from "@/components/forge/KeySetupDialog";
import { ALL_TAB_VALUES, RackMobileNav, RackSidebar } from "@/components/forge/RackNav";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { emptyState, type ForgeState, type BlendSlice } from "@/components/forge/types";
import { WorkspaceBar } from "@/components/forge/WorkspaceBar";
import { Toaster } from "@/components/ui/sonner";
import { getSharedBlend } from "@/lib/forge.functions";
import type { BlendResult } from "@/components/forge/types";
import { toast } from "sonner";
import { decodeShare, tokenFromHash, type SharePayload } from "@/lib/share";
import { track } from "@/lib/stats";
import { mergeSymptoms } from "@/lib/symptoms";
import { HANDOFF_KEYS, readHandoff, type ParsedHandoff } from "@/lib/handoff";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — AI Music Pre-Production` },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      { property: "og:title", content: APP_NAME },
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


function Index() {
  // Always "blend" on the server and first paint; a ?tab= link is applied right after
  // hydration (reading the URL during render made server and client disagree).
  const [tab, setTabState] = useState("blend");
  // Every tool switch goes through here so usage counts match what people open.
  const setTab = useCallback((t: string) => {
    setTabState(t);
    track("tab_open", t, { once: true });
  }, []);
  const [state, setState] = useState<ForgeState>(emptyState);
  const [shared, setShared] = useState<SharePayload | null>(null);
  const [mode, setMode] = useState<"guided" | "rack">("rack");
  const [assistantAutoRun, setAssistantAutoRun] = useState(true);
  const [blendAutoRun, setBlendAutoRun] = useState(false);
  const [blendFlashKey, setBlendFlashKey] = useState(0);

  // A landing-page handoff is read from the URL once and remembered, because the URL is
  // cleaned right after and effects can run twice (React StrictMode in development).
  const handoffRef = useRef<ParsedHandoff | null | undefined>(undefined);
  const getHandoff = () => {
    if (handoffRef.current === undefined) handoffRef.current = readHandoff(window.location.search);
    return handoffRef.current;
  };

  // A ?tab= link opens that tool; otherwise first-time visitors land on "Start here".
  useEffect(() => {
    try {
      if (getHandoff()) {
        localStorage.setItem("blf.visited", "1");
        return; // the handoff effect below picks the tab
      }
      const asked = new URLSearchParams(window.location.search).get("tab");
      const first = asked && ALL_TAB_VALUES.includes(asked)
        ? asked
        : !localStorage.getItem("blf.visited")
          ? "assistant"
          : "blend";
      setTab(first);
      localStorage.setItem("blf.visited", "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // What a visitor typed on the landing page arrives here as ?describe= / ?artist= / ?song=.
  // Read once after hydration, applied, then removed from the address bar.
  const [assistantStart, setAssistantStart] = useState<string | null>(null);
  useEffect(() => {
    const got = getHandoff();
    if (!got) return;
    const { handoff, sliders, sunoVersion } = got;
    setState((prev) => ({
      ...prev,
      blend: {
        ...prev.blend,
        ...(sliders ? { sliders } : {}),
        ...(sunoVersion ? { sunoVersion } : {}),
        ...(handoff.kind === "artists"
          ? { lookupMode: "band" as const, artists: [...handoff.artists, "", "", ""].slice(0, 3), result: null }
          : {}),
        ...(handoff.kind === "song" ? { lookupMode: "song" as const, songTitle: handoff.song, result: null } : {}),
      },
    }));
    if (handoff.kind === "describe") {
      setAssistantStart(handoff.text);
      setTab("assistant");
    } else {
      setTab("blend");
      setBlendAutoRun(true);
    }
    track("start_choice", `landing_${handoff.kind}`, { once: true });
    const q = new URLSearchParams(window.location.search);
    HANDOFF_KEYS.forEach((k) => q.delete(k));
    const rest = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  }, []);

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
        <TooltipProvider delayDuration={400}>
        <div className="min-h-screen pb-12">
          <header className="mx-auto max-w-7xl px-4 pt-8 pb-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="glow-primary flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                  <AudioLines className="size-5 text-primary" />
                </span>
                <div>
                  <h1 className="neon-text font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    {APP_NAME}
                  </h1>
                  <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                    {APP_TAGLINE}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
              <AiStatusButton />
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
                onExitToTab={(t) => { changeMode("rack"); setTab(t); }}
                onExitToFixTake={() => { changeMode("rack"); setTab("fix"); }}
              />
            ) : (
              /* ── Rack Console (left nav + content) ── */
              <div className="flex gap-5 lg:items-start">
                <RackSidebar tab={tab} onTab={setTab} />

                <div className="min-w-0 flex-1">
                  <RackMobileNav tab={tab} onTab={setTab} />

                  {/* Tab content — conditional rendering */}
                  {tab === "blend" && (
                    <BandBlender
                      value={state.blend}
                      onChange={(v) => patch("blend", v)}
                      onSendToForge={() => setTab("lyrics")}
                      onOpenSunoSheet={() => setTab("suno")}
                      autoRun={blendAutoRun}
                      onAutoRunDone={() => setBlendAutoRun(false)}
                      flashKey={blendFlashKey}
                      takes={state.takes}
                      onTakes={(v) => patch("takes", v)}
                      onFix={(symptoms) => {
                        setState((prev) => ({
                          ...prev,
                          fix: { ...prev.fix, symptoms: mergeSymptoms(prev.fix.symptoms, symptoms), result: null },
                        }));
                        setTab("fix");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
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
                      value={state.dossiers}
                      onChange={(v) => patch("dossiers", v)}
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
                      onOpenMastering={() => setTab("master")}
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
                  {tab === "master" && <MasteringLab onOpenFix={() => setTab("fix")} />}
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
                  {tab === "assistant" && (
                    <StudioAssistant
                      currentBlend={state.blend}
                      onGoTab={setTab}
                      onAddToStyle={(line) => {
                        const cur = state.blend.result?.styleTag?.trim() ?? "";
                        patch("blend", {
                          ...state.blend,
                          result: { ...(state.blend.result ?? {}), styleTag: cur ? `${cur}, ${line}` : line },
                        });
                        toast.success("Added to your style prompt. Find it in Band Blender and the Export Sheet.");
                      }}
                      onFixSong={(notes) => {
                        patch("fix", { ...state.fix, notes, result: null });
                        setTab("fix");
                      }}
                      autoRun={assistantAutoRun}
                      onToggleAutoRun={setAssistantAutoRun}
                      initialMessage={assistantStart}
                      onInitialMessageSent={() => setAssistantStart(null)}
                      onApply={(intent) => {
                        const newBlend: BlendSlice = {
                          ...state.blend,
                          lookupMode: "band",
                          artists: [intent.artist_1, intent.artist_2, intent.artist_3].map(
                            (a, i) => a || (state.blend.artists[i] ?? ""),
                          ),
                          targetGenre: intent.target_genre || state.blend.targetGenre,
                          targetEra: intent.era || state.blend.targetEra,
                          sliders: {
                            energy: intent.energy,
                            complexity: intent.complexity,
                            brightness: intent.brightness,
                          },
                          result: null,
                        };
                        patch("blend", newBlend);
                        setTab("blend");
                        setBlendFlashKey((k) => k + 1);
                        if (assistantAutoRun) {
                          setBlendAutoRun(true);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </main>

          <KeySetupDialog />
          <Toaster />
        </div>
        </TooltipProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
