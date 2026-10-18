/**
 * Formats one blend + lyrics for each AI music engine. Pure (no network).
 * Character limits are third-party measurements and may change; update them here.
 */

/**
 * Suno first; ElevenLabs as a secondary export. Udio was removed in Oct 2026 because it has
 * blocked all downloads since its Oct 2025 settlement; add it back here if that changes.
 */
export type Engine = "suno" | "eleven";

export const ENGINE_LABELS: Record<Engine, string> = {
  suno: "Suno v6",
  eleven: "ElevenLabs Music",
};

export const ENGINE_LIMITS = {
  /** ElevenLabs Music prompt field (lyrics included). */
  elevenPrompt: 4100,
} as const;

export type EngineInput = {
  title: string;
  style: string;
  exclude: string;
  vocal: string;
  genre?: string | undefined;
  tempo?: string | undefined;
  mood?: string | undefined;
  instrumentation?: string | undefined;
  lyrics: string;
};

export type EngineField = { label: string; value: string; max?: number; hint?: string };

const clean = (s: string | undefined) => (s ?? "").trim().replace(/[.\s]+$/, "");

/** ElevenLabs reads plain-English direction better than tag lists. */
export function elevenPrompt(i: EngineInput): string {
  const genre = clean(i.genre) || clean(i.style.split(",")[0]);
  const parts = [
    `${clean(i.mood) ? `A ${clean(i.mood).toLowerCase()} ` : "A "}${genre || "song"} track${clean(i.tempo) ? `, ${clean(i.tempo)}` : ""}.`,
    clean(i.instrumentation) && `Instrumentation: ${clean(i.instrumentation)}.`,
    clean(i.vocal) && `Vocals: ${clean(i.vocal)}.`,
    clean(i.style) && `Sound: ${clean(i.style)}.`,
    clean(i.exclude) && `Avoid: ${clean(i.exclude)}.`,
  ].filter(Boolean);
  const head = parts.join(" ");
  return i.lyrics.trim() ? `${head}\n\nLyrics:\n${i.lyrics.trim()}` : head;
}

export function buildEngineExport(engine: Engine, i: EngineInput): EngineField[] {
  if (engine === "eleven") {
    return [
      { label: "Title", value: i.title, hint: "Used as the track name only." },
      {
        label: "Prompt (with lyrics)",
        value: elevenPrompt(i),
        max: ENGINE_LIMITS.elevenPrompt,
        hint: "Paste into ElevenLabs Music. Plain sentences, lyrics at the end, section tags kept.",
      },
    ];
  }
  return [];
}
