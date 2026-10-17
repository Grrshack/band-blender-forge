import { composeSunoLyrics, normalizeSunoVersion, type SunoVersion, vocalString } from "@/lib/suno";
import type { Take } from "@/lib/takes";

/** What MusicBrainz said about an artist. "unavailable" means the lookup failed — NOT that the artist doesn't exist. */
export type MbInfo = {
  name: string;
  status: "found" | "not_found" | "unavailable";
  matchedName?: string | undefined;
  tags: string[];
  country?: string | undefined;
  type?: string | undefined;
};

/** One of the three alternative style prompts (safe / experimental / hybrid). */
export type StyleVariant = {
  label: string;
  angle: string;
  styleTag: string;
  excludeStyles: string;
  vocalLine: string;
};

export type BlendResult = {
  confidence?: { level?: string; note?: string };
  genre?: string;
  tempo?: string;
  instrumentation?: string;
  vocals?: string;
  mood?: string;
  styleTag?: string;
  reconciliation?: string;
  recommendedSliders?: { energy?: number; complexity?: number; brightness?: number };
  sliderNotes?: string;
  /** Vocals split into the parts Suno responds to. */
  vocalPrompt?: { voice?: string; delivery?: string; harmonies?: string; effects?: string };
  /** Goes in Suno's "Exclude styles" box. */
  excludeStyles?: string;
  /** Artist names that had to be stripped from the style fields after generation. */
  styleWarnings?: string[];
  /** Real-data check of the input artists. */
  grounding?: MbInfo[];
  /** Suno v6 bracket vocal tags, e.g. "[Female Vocal], [Whisper]" */
  voiceTags?: string;
  /** Potential contradictions in the style tag the user should know about. */
  contradictions?: string[];
  variants?: StyleVariant[];
  /** Changes made by the last Style Chat refinement — persisted so they survive tab switches. */
  refineChanges?: string[];
};

export type Line = { text: string; locked: boolean; previous?: string };
/** `cue` is a performance direction Suno reads, e.g. "Whispered, sparse". Empty `lines` = instrumental section. */
export type Section = { tag: string; cue?: string | undefined; lines: Line[] };

export type CompareResult = {
  summary?: string;
  artists?: Array<{ name?: string; match?: number; reasoning?: string[]; mb?: MbInfo }>;
};

export type CritiqueResult = {
  verdict?: string;
  scores?: Array<{ label?: string; score?: number; note?: string }>;
  cliches?: Array<{ line?: string; why?: string; fix?: string }>;
  prosody?: Array<{ line?: string; note?: string }>;
  fixFirst?: string[];
};

export type FixResult = {
  /** Best next step: edit parts of this take in Suno v6, regenerate with a new prompt, or fix it in mastering. */
  fixRoute?: "edit" | "regenerate" | "master";
  routeWhy?: string;
  /** Plain-language instructions for Suno v6's edit feature. */
  sunoEdits?: Array<{ target?: string; instruction?: string }>;
  diagnosis?: string;
  changes?: Array<{ change?: string; why?: string }>;
  styleTag?: string;
  excludeStyles?: string;
  lyricFixes?: Array<{ line?: string; fix?: string }>;
  tryNext?: string;
  styleWarnings?: string[];
};

export type FixSlice = {
  symptoms: string[];
  notes: string;
  result: FixResult | null;
  /** The style/exclude text that was replaced by "Apply", so it can be undone. */
  undo: { styleTag: string; excludeStyles: string } | null;
};

export type BlendSlice = {
  artists: string[];
  sliders: { energy: number; complexity: number; brightness: number };
  result: BlendResult | null;
  /** "band" blends multiple artists; "song" analyses one specific recording. */
  lookupMode: "band" | "song";
  /** Used only when lookupMode === "song". */
  songTitle: string;
  /** Which Suno generation to target — affects style tag length and format. */
  sunoVersion: SunoVersion;
  /** Optional genre to bias the blend toward. Empty = no bias. */
  targetGenre: string;
  /** When true, the style tag must stay within the target genre family. */
  genreLock: boolean;
  /** Optional era/decade to bias the blend toward. Empty = no bias. */
  targetEra: string;
};

export type LyricSlice = {
  theme: string;
  hook: string;
  notes: string;
  title: string;
  sections: Section[];
  /** Plain-text song-length plan that steers generation (see the length planner). */
  structure?: string | undefined;
  /** Generate section structure only — no lyric lines. User writes the words. */
  tagsOnly: boolean;
  /** Manually pasted Suno style prompt when no blend is linked. */
  manualStyle: string;
  /**
   * Running count of watch-words seen across lyric generations this session.
   * Words with count >= 2 are soft-avoided in the next generation.
   */
  recentWords: Record<string, number>;
  /** User blacklist, comma-separated ("alone, voice"). Hard-banned from generated lyrics. */
  bannedWords?: string | undefined;
};

export type DossierResult = {
  titleOptions?: string[];
  coverArtPrompt?: string;
  coverArtAlt?: string;
  metadata?: {
    primaryGenre?: string;
    secondaryGenre?: string;
    moods?: string[];
    bpm?: string;
    key?: string;
    explicit?: boolean;
    language?: string;
  };
  shortDescription?: string;
  bio?: string;
  playlistPitch?: string;
  socialHooks?: Array<{ platform?: string; hook?: string; clip?: string }>;
  hashtags?: string[];
  releaseTips?: string[];
};

export type MasterSuggestResult = {
  preset?: string;
  adjustments?: Record<string, unknown>;
  reasoning?: string;
  warnings?: string[];
};

export type MasterSlice = {
  intent: string;
  result: MasterSuggestResult | null;
};

export type CompareSlice = {
  lyrics: string;
  tags: string;
  result: CompareResult | null;
};

export type CritiqueSlice = {
  lyrics: string;
  notes: string;
  result: CritiqueResult | null;
};

export type ForgeState = {
  blend: BlendSlice;
  lyrics: LyricSlice;
  compare: CompareSlice;
  critique: CritiqueSlice;
  fix: FixSlice;
  master: MasterSlice;
  /** Log of generated takes, newest last. */
  takes: Take[];
  /** Release dossiers — most recent first, capped at 3. */
  dossiers: DossierResult[];
};

export const emptyState = (): ForgeState => ({
  blend: {
    artists: ["", "", ""],
    sliders: { energy: 60, complexity: 50, brightness: 55 },
    result: null,
    lookupMode: "band",
    songTitle: "",
    sunoVersion: "mini",
    targetGenre: "",
    genreLock: false,
    targetEra: "",
  },
  lyrics: { theme: "", hook: "", notes: "", title: "", sections: [], tagsOnly: false, manualStyle: "", recentWords: {} },
  compare: { lyrics: "", tags: "", result: null },
  critique: { lyrics: "", notes: "", result: null },
  fix: { symptoms: [], notes: "", result: null, undo: null },
  master: { intent: "", result: null },
  takes: [],
  dossiers: [],
});

export function hasContent(s: ForgeState): boolean {
  return Boolean(
    s.blend.artists.some((a) => a.trim()) ||
    s.blend.result ||
    s.lyrics.theme.trim() ||
    s.lyrics.sections.length ||
    s.compare.lyrics.trim() ||
    s.compare.tags.trim() ||
    s.compare.result ||
    s.critique.lyrics.trim() ||
    s.critique.result ||
    s.fix.notes.trim() ||
    s.fix.symptoms.length ||
    s.fix.result ||
    s.takes.length ||
    s.dossiers.length > 0,
  );
}

export function mergeState(raw: unknown): ForgeState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  // Use a loose record so we can handle both the new shape and legacy saves.
  const s = raw as Record<string, unknown>;
  const blend = (s["blend"] && typeof s["blend"] === "object" ? s["blend"] : {}) as Partial<BlendSlice>;
  const lyrics = (s["lyrics"] && typeof s["lyrics"] === "object" ? s["lyrics"] : {}) as Partial<LyricSlice>;
  const master = (s["master"] && typeof s["master"] === "object" ? s["master"] : {}) as Partial<MasterSlice>;
  return {
    blend: {
      ...base.blend,
      ...blend,
      // Deep-merge sliders so a save with only some keys still keeps defaults.
      sliders: { ...base.blend.sliders, ...(blend.sliders ?? {}) },
      // Older saves may hold the retired "pro" option.
      sunoVersion: normalizeSunoVersion(blend.sunoVersion ?? base.blend.sunoVersion),
    },
    lyrics: {
      ...base.lyrics,
      ...lyrics,
      // Deep-merge recentWords so per-word counts survive partial saves.
      recentWords: {
        ...base.lyrics.recentWords,
        ...(lyrics.recentWords && typeof lyrics.recentWords === "object" ? lyrics.recentWords : {}),
      },
    },
    compare: { ...base.compare, ...(s["compare"] && typeof s["compare"] === "object" ? s["compare"] : {}) },
    critique: { ...base.critique, ...(s["critique"] && typeof s["critique"] === "object" ? s["critique"] : {}) },
    fix: { ...base.fix, ...(s["fix"] && typeof s["fix"] === "object" ? s["fix"] : {}) },
    master: { ...base.master, ...master },
    takes: Array.isArray(s["takes"]) ? s["takes"] : base.takes,
    // Accept the new array shape or silently migrate a legacy single-dossier save.
    dossiers: Array.isArray(s["dossiers"])
      ? (s["dossiers"] as DossierResult[])
      : s["dossier"] && typeof s["dossier"] === "object"
        ? [s["dossier"] as DossierResult]
        : [],
  };
}

export function exportBrief(name: string, state: ForgeState): string {
  const out: string[] = [`# ${name}`];
  const b = state.blend.result;
  const artists = state.blend.artists.filter((a) => a.trim());
  if (artists.length) out.push(`\n## Blend\nArtists: ${artists.join(" + ")}`);
  if (b) {
    out.push(
      [
        `Genre: ${b.genre ?? "—"}`,
        `Tempo: ${b.tempo ?? "—"}`,
        `Instrumentation: ${b.instrumentation ?? "—"}`,
        `Vocals: ${b.vocals ?? "—"}`,
        `Mood: ${b.mood ?? "—"}`,
        ``,
        `Style tag: ${b.styleTag ?? "—"}`,
        ...(vocalString(b.vocalPrompt) ? [`Vocal prompt: ${vocalString(b.vocalPrompt)}`] : []),
        ...(b.excludeStyles ? [`Exclude styles: ${b.excludeStyles}`] : []),
        ``,
        `Reconciliation: ${b.reconciliation ?? "—"}`,
      ].join("\n"),
    );
  }
  if (state.lyrics.sections.length) {
    out.push(`\n## Lyrics — ${state.lyrics.title || "Untitled"}`);
    out.push(composeSunoLyrics(state.lyrics.sections));
  }
  const artistsOut = state.compare.result?.artists ?? [];
  if (artistsOut.length) {
    out.push(`\n## Comparable artists`);
    out.push(
      artistsOut
        .map(
          (a) =>
            `${a.name} (${a.match ?? "—"}%)\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`,
        )
        .join("\n\n"),
    );
  }
  const c = state.critique.result;
  if (c) {
    out.push(`\n## Honest feedback\n${c.verdict ?? ""}`);
    if (c.scores?.length) {
      out.push(c.scores.map((s) => `${s.label}: ${s.score}/10 — ${s.note}`).join("\n"));
    }
    if (c.fixFirst?.length) {
      out.push(`Fix first:\n${c.fixFirst.map((f, i) => `${i + 1}. ${f}`).join("\n")}`);
    }
  }
  const f = state.fix.result;
  if (f?.diagnosis) {
    out.push(`\n## Last take diagnosis\n${f.diagnosis}`);
    if (f.tryNext) out.push(`Try next: ${f.tryNext}`);
  }
  return out.join("\n");
}
