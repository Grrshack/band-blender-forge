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
};

export type Line = { text: string; locked: boolean; previous?: string };
export type Section = { tag: string; lines: Line[] };

export type CompareResult = {
  summary?: string;
  artists?: Array<{ name?: string; match?: number; reasoning?: string[] }>;
};

export type CritiqueResult = {
  verdict?: string;
  scores?: Array<{ label?: string; score?: number; note?: string }>;
  cliches?: Array<{ line?: string; why?: string; fix?: string }>;
  prosody?: Array<{ line?: string; note?: string }>;
  fixFirst?: string[];
};

export type BlendSlice = {
  artists: string[];
  sliders: { energy: number; complexity: number; brightness: number };
  result: BlendResult | null;
};

export type LyricSlice = {
  theme: string;
  hook: string;
  notes: string;
  title: string;
  sections: Section[];
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
};

export const emptyState = (): ForgeState => ({
  blend: {
    artists: ["", "", ""],
    sliders: { energy: 60, complexity: 50, brightness: 55 },
    result: null,
  },
  lyrics: { theme: "", hook: "", notes: "", title: "", sections: [] },
  compare: { lyrics: "", tags: "", result: null },
  critique: { lyrics: "", notes: "", result: null },
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
      s.critique.result,
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
        ``,
        `Reconciliation: ${b.reconciliation ?? "—"}`,
      ].join("\n"),
    );
  }
  if (state.lyrics.sections.length) {
    out.push(`\n## Lyrics — ${state.lyrics.title || "Untitled"}`);
    out.push(
      state.lyrics.sections
        .map((s) => `${s.tag}\n${s.lines.map((l) => l.text).join("\n")}`)
        .join("\n\n"),
    );
  }
  const artistsOut = state.compare.result?.artists ?? [];
  if (artistsOut.length) {
    out.push(`\n## Comparable artists`);
    out.push(
      artistsOut
        .map((a) => `${a.name} (${a.match ?? "—"}%)\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`)
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
  return out.join("\n");
}
