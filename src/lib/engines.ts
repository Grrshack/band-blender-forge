/**
 * Formats one blend + lyrics for each AI music engine. Pure (no network).
 * Character limits are third-party measurements and may change; update them here.
 */

export type Engine = "suno" | "eleven" | "udio";

export const ENGINE_LABELS: Record<Engine, string> = {
  suno: "Suno v6",
  eleven: "ElevenLabs Music",
  udio: "Udio",
};

export const ENGINE_LIMITS = {
  /** ElevenLabs Music prompt field (lyrics included). */
  elevenPrompt: 4100,
  /** Udio's prompt box works best short; tags past this get ignored. */
  udioPrompt: 300,
  udioLyrics: 3000,
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

/** Cuts at the last comma so no tag is sliced in half. */
function fitTags(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const comma = cut.lastIndexOf(",");
  return (comma > max * 0.5 ? cut.slice(0, comma) : cut).trim();
}

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
  if (engine === "udio") {
    const tags = [i.style, i.vocal].filter((x) => x.trim()).join(", ");
    return [
      { label: "Title", value: i.title },
      {
        label: "Prompt",
        value: fitTags(tags, ENGINE_LIMITS.udioPrompt),
        max: ENGINE_LIMITS.udioPrompt,
        hint: "Short tag list — Udio weights the first few tags most.",
      },
      {
        label: "Custom lyrics",
        value: i.lyrics,
        max: ENGINE_LIMITS.udioLyrics,
        hint: "Choose Custom lyrics in Udio. Section tags like [Verse] work as-is.",
      },
    ];
  }
  return [];
}
