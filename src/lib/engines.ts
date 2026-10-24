/**
 * Formats one blend + lyrics for each AI music engine. Pure (no network).
 * Character limits are third-party measurements and may change; update them here.
 */

/**
 * Suno first; ElevenLabs as a secondary export. Udio was removed in Oct 2026 because it has
 * blocked all downloads since its Oct 2025 settlement; add it back here if that changes.
 */
export type Engine = "suno" | "gemini" | "eleven";

export const ENGINE_LABELS: Record<Engine, string> = {
  suno: "Suno v6",
  gemini: "Gemini / Flow",
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

/**
 * Google's Lyria 3.5 (Gemini app and Flow Music) takes one plain-English request with the
 * lyrics and their [Verse]/[Chorus] tags inside it. It blocks artist names and known lyrics.
 */
export function geminiPrompt(i: EngineInput): string {
  const genre = clean(i.genre) || clean(i.style.split(",")[0]);
  const lines = [
    `Create a full song${genre ? ` in the style of ${genre.toLowerCase()} music` : ""}${clean(i.tempo) ? `, ${clean(i.tempo)}` : ""}.`,
    clean(i.style) && `Sound: ${clean(i.style)}.`,
    clean(i.instrumentation) && `Instruments: ${clean(i.instrumentation)}.`,
    clean(i.vocal) ? `Vocals: ${clean(i.vocal)}.` : "",
    clean(i.mood) && `Mood: ${clean(i.mood)}.`,
    clean(i.exclude) && `Avoid: ${clean(i.exclude)}.`,
    i.lyrics.trim() ? "Use exactly these lyrics, following the section tags:" : "Make it instrumental.",
  ].filter(Boolean);
  return i.lyrics.trim() ? `${lines.join(" ")}\n\n${i.lyrics.trim()}` : lines.join(" ");
}

export function buildEngineExport(engine: Engine, i: EngineInput): EngineField[] {
  if (engine === "gemini") {
    return [
      {
        label: "Prompt for Gemini or Flow Music",
        value: geminiPrompt(i),
        hint: "Paste into the Gemini app (Create music) or Flow Music. Songs come out about 2 minutes long. Like the result? Download it and upload it to Suno as a starting point; see the guide 'Sketch in Gemini, finish in Suno'.",
      },
    ];
  }
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
