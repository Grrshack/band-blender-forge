import { composeSunoLyrics, vocalString } from "@/lib/suno";
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
  variants?: StyleVariant[];
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
  sunoVersion: "mini" | "v6" | "pro";
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
  /** Log of generated takes, newest last. */
  takes: Take[];
};

export const emptyState = (): ForgeState => ({
  blend: {
    artists: ["", "", ""],
    sliders: { energy: 60, complexity: 50, brightness: 55 },
    result: null,
    lookupMode: "band",
    songTitle: "",
    sunoVersion: "v6",
  },
  lyrics: { theme: "", hook: "", notes: "", title: "", sections: [], tagsOnly: false, manualStyle: "", recentWords: {} },
  compare: { lyrics: "", tags: "", result: null },
  critique: { lyrics: "", notes: "", result: null },
  fix: { symptoms: [], notes: "", result: null, undo: null },
  takes: [],
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
    s.takes.length,
  );
}

export function mergeState(raw: unknown): ForgeState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<ForgeState>;
  return {
    blend: { ...base.blend, ...(s.blend ?? {}) },
    lyrics: { ...base.lyrics, ...(s.lyrics ?? {}) },
    compare: { ...base.compare, ...(s.compare ?? {}) },
    critique: { ...base.critique, ...(s.critique ?? {}) },
    fix: { ...base.fix, ...(s.fix ?? {}) },
    takes: Array.isArray(s.takes) ? s.takes : base.takes,
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
