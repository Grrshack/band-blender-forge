/**
 * Prompt craft: Band Blender's own rules for writing Suno prompts that hold together.
 *
 * Two style formats:
 * - "tags": the classic comma-separated list, genre first.
 * - "brief": a Studio Brief — a few plain sentences written the way a producer briefs a
 *   session band. It covers six things in order: Sound, Pulse, Players, Voice, Arc, Finish.
 *
 * Everything here is pure so prompts, pre-flight and the Export Sheet share one source.
 */

import { SUNO_LIMITS } from "./suno";

export type PromptFormat = "tags" | "brief";

export const PROMPT_FORMAT_LABELS: Record<PromptFormat, string> = {
  tags: "Tag list",
  brief: "Studio brief",
};

/** The Studio Brief, in order. Shown in the UI and written into the AI instructions. */
export const BRIEF_PARTS = [
  { key: "sound", label: "Sound", hint: "Genre and mood in the first few words." },
  { key: "pulse", label: "Pulse", hint: "Tempo in BPM plus how it feels: driving, laid-back, swung." },
  { key: "players", label: "Players", hint: "Who plays what, and what they're doing (picked, pulsing, stabbing)." },
  { key: "voice", label: "Voice", hint: "Who sings, how, and where the voice sits in the mix." },
  { key: "arc", label: "Arc", hint: "How it moves: what the verses hold back and what the chorus adds." },
  { key: "finish", label: "Finish", hint: "The room and the mix: dry or roomy, wide or tight, clean or worn." },
] as const;

export function normalizePromptFormat(v: unknown): PromptFormat {
  return v === "brief" ? "brief" : "tags";
}

/** The "styleTag" field description for the blend and song prompts. */
export function styleFieldSpec(format: PromptFormat, max: number): string {
  if (format === "brief") {
    return `a Studio Brief for Suno's style box: 3-6 short plain sentences, max ${max} characters, covering in this order — Sound (genre and mood in the first five words), Pulse (one BPM number plus the feel), Players (two to four instruments, each with what it is doing), Voice (who sings, the delivery, and where the voice sits: close and upfront, or set back), Arc (what the verses hold back and what the chorus adds), Finish (the room and mix). Concrete production words only; no negatives (those go in excludeStyles).`;
  }
  return `a single comma-separated Suno style prompt line, ordered: genre, subgenre, tempo/bpm, instrumentation, vocal type, production, mood. Front-load genre and mood. Max ${max} characters.`;
}

/** One-line rule for tasks that rewrite an existing style (refine, variants, fix, reimagine). */
export function styleRule(format: PromptFormat, max: number): string {
  return format === "brief"
    ? `Write the style as a Studio Brief: 3-6 short plain sentences, genre and mood in the first five words, then tempo and feel, instruments with what they do, the voice and where it sits, how the sections build, and the mix. Max ${max} characters.`
    : `Write the style as one comma-separated line, genre and mood first, max ${max} characters.`;
}

/** Rules that apply in either format, added to the blend and song prompts. */
export const VOCAL_PLACEMENT_RULE =
  "If the vocal is soft, breathy, whispered or intimate, also say it is close-miked, dry and clearly above the band; on its own, \"soft\" makes Suno push the voice back into the mix.";

/** Rough guess at whether a style is written as sentences rather than a tag list. */
export function looksLikeBrief(style: string): boolean {
  const s = style.trim();
  if (!s) return false;
  const sentences = s.split(/[.!?](\s|$)/).filter((x) => x && x.trim().split(/\s+/).length >= 5).length;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const avgWords = parts.reduce((n, p) => n + p.split(/\s+/).length, 0) / Math.max(parts.length, 1);
  return sentences >= 2 || avgWords >= 6;
}

// ---------------------------------------------------------------------------------------------
// Vocal placement

const SOFT_WORD = "soft|softly|gentle|gently|breathy|hushed|delicate|tender|intimate|airy|quiet";
const VOCAL_WORD = "vocals?|voice|singer|singing|sung|sings|lead|alto|soprano|tenor|baritone|falsetto|croon(?:ed|ing)?";
/** A soft word describing the voice ("soft breathy female vocal", "vocals soft and airy"), or a whisper. */
const SOFT_VOCAL = new RegExp(
  `\\b(?:${SOFT_WORD})\\b(?:[\\s,-]+[a-z-]+){0,2}?[\\s,-]+(?:${VOCAL_WORD})\\b|\\b(?:${VOCAL_WORD})\\b(?:[\\s,-]+[a-z-]+){0,2}?[\\s,-]+(?:${SOFT_WORD})\\b|\\bwhisper(?:ed|y|ing|s)?\\b`,
  "i",
);
const PLACED = /\b(close[- ]?mi(?:c|ke)d?|upfront|up[- ]front|forward|dry vocal|dry,|(?:clearly )?above the [a-z]+|on top of the (?:mix|band)|front of the mix|lead vocal loud|in your ear|close and (?:clear|dry|upfront))\b/i;

/** True when the style asks for a soft voice but never says where it sits. */
export function softVocalUnplaced(style: string): boolean {
  return SOFT_VOCAL.test(style) && !PLACED.test(style);
}

export const VOCAL_PLACEMENT_CLAUSE = "close-miked dry lead vocal, upfront and clearly above the band";

/** Adds the placement clause in the style's own format. */
export function placeVocal(style: string): string {
  const s = style.trim().replace(/[,.\s]+$/, "");
  if (!s || !softVocalUnplaced(s)) return style;
  const brief = looksLikeBrief(s);
  const full = brief
    ? `${s}. The voice is close-miked and dry, sitting upfront and clearly above the band.`
    : `${s}, ${VOCAL_PLACEMENT_CLAUSE}`;
  if (full.length <= SUNO_LIMITS.style) return full;
  // Not much room left in the style box: the short version.
  const short = brief ? `${s}. Close-miked, upfront vocal.` : `${s}, close-miked upfront vocal`;
  return short.length <= SUNO_LIMITS.style ? short : style;
}

// ---------------------------------------------------------------------------------------------
// Mix and arrangement clauses for the Export Sheet

export type Clause = { id: string; label: string; help: string; tag: string; brief: string; exclude?: string };

export const MIX_CLAUSES: Clause[] = [
  {
    id: "clean",
    label: "Clean mix",
    help: "Separation between instruments, a clear vocal, a finished-sounding master.",
    tag: "clean modern mix, clear separation, polished master",
    brief: "Mixed clean and modern, every part with its own space and a finished, polished master.",
    exclude: "muddy mix, distortion artifacts",
  },
  {
    id: "compact",
    label: "Short & tight",
    help: "For a full style box: the same idea in a few words.",
    tag: "clean tight mix",
    brief: "Tight, clean mix.",
  },
  {
    id: "heavy",
    label: "Heavy but clear",
    help: "Loud genres: weight without the low end swallowing everything.",
    tag: "heavy but defined low end, punchy drums, guitars and vocal stay distinct",
    brief: "Heavy and loud, but the low end stays defined and the drums punch through, so guitars and voice never smear together.",
    exclude: "muddy low end, harsh fizz",
  },
  {
    id: "vocal",
    label: "Vocal first",
    help: "When the voice gets buried: puts it on top.",
    tag: "lead vocal upfront, dry and clear above the band",
    brief: "The lead vocal is the loudest thing in the mix, dry, clear and sitting above the band.",
    exclude: "buried vocals, distant vocals, washed-out reverb",
  },
  {
    id: "full",
    label: "Full verses",
    help: "Stops verses from dropping to near silence after the intro.",
    tag: "full band through the verses, steady energy",
    brief: "The band keeps playing through the verses, energy holding steady instead of dropping out.",
    exclude: "empty verses, long silences",
  },
  {
    id: "ending",
    label: "Clean ending",
    help: "Every lyric gets sung, then a short instrumental tail and a real stop.",
    tag: "sings every lyric, short instrumental outro, clean stop",
    brief: "Every lyric is sung before a short instrumental outro that ends cleanly.",
    exclude: "fade-out, endless outro",
  },
];

/** Joins a clause onto a style in the style's own format. */
export function addClause(style: string, c: Clause): string {
  const s = style.trim().replace(/[,\s]+$/, "");
  if (!s) return looksLikeBrief(c.brief) ? c.brief : c.tag;
  if (looksLikeBrief(s)) return `${s.replace(/\.?$/, ".")} ${c.brief}`;
  return `${s}, ${c.tag}`;
}

export function hasClause(style: string, c: Clause): boolean {
  const s = style.toLowerCase();
  // The vocal is already placed (for example by the pre-flight fix): don't offer it twice.
  if (c.id === "vocal" && PLACED.test(style)) return true;
  return s.includes(c.tag.toLowerCase()) || s.includes(c.brief.toLowerCase());
}

/** Merges new comma-separated traits into an exclude list, skipping duplicates and anything the style asks for. */
export function mergeExcludes(current: string, add: string, style = "", max: number = SUNO_LIMITS.exclude): string {
  const have = current.split(",").map((t) => t.trim()).filter(Boolean);
  const seen = new Set(have.map((t) => t.toLowerCase()));
  const styleLower = style.toLowerCase();
  for (const t of add.split(",").map((x) => x.trim()).filter(Boolean)) {
    const k = t.toLowerCase();
    if (seen.has(k) || styleLower.includes(k)) continue;
    // Never push the list past Suno's Exclude styles limit.
    if ([...have, t].join(", ").length > max) break;
    seen.add(k);
    have.push(t);
  }
  return have.join(", ");
}

/** Traits most takes are better without. Offered as one merge. */
export const COMMON_EXCLUDES = "muddy mix, buried vocals, fade-out, distorted vocals, random spoken words";

// ---------------------------------------------------------------------------------------------
// Song ends and intros

const ENDING_TAG = /^\[(outro|instrumental outro|end|hard stop|fade out|fade-out)[^\]]*\]$/i;

/**
 * Makes sure the lyrics finish with an instrumental tail and a stop marker, so Suno doesn't cut
 * the last line or ramble on. Replaces a bare trailing [Outro] with no words under it.
 */
export function withCleanEnding(lyrics: string): string {
  const lines = lyrics.replace(/\s+$/, "").split("\n");
  while (lines.length && (ENDING_TAG.test(lines[lines.length - 1]!.trim()) || !lines[lines.length - 1]!.trim())) {
    lines.pop();
  }
  return `${lines.join("\n")}\n\n[Instrumental Outro]\n[End]`.trimStart();
}

/**
 * The lyrics as they should go to Suno: with the clean ending when asked for and when it
 * still fits Suno's 5,000-character lyrics box. `added` says whether the ending went on.
 */
export function exportLyrics(lyrics: string, cleanEnding: boolean, max: number = SUNO_LIMITS.lyrics): { text: string; added: boolean; noRoom: boolean } {
  if (!cleanEnding || !lyrics.trim()) return { text: lyrics, added: false, noRoom: false };
  const withEnd = withCleanEnding(lyrics);
  if (withEnd.length > max && withEnd.length > lyrics.length) return { text: lyrics, added: false, noRoom: true };
  return { text: withEnd, added: true, noRoom: false };
}

/** Lyrics budget given to the AI: under Suno's box, with room for the ending tags and edits. */
export const LYRIC_CHAR_BUDGET = SUNO_LIMITS.lyrics - 400;

export function hasCleanEnding(lyrics: string): boolean {
  return /\[(end|hard stop)\]\s*$/i.test(lyrics.trim());
}

// ---------------------------------------------------------------------------------------------
// Lyric notation: punctuation Suno tends to perform

export const LYRIC_NOTATION = [
  { mark: "...", effect: "a breath or a held note at the end of the line" },
  { mark: "—", effect: "a sudden cut, the line stops short" },
  { mark: "CAPS", effect: "a strained, louder word; use on one or two words, not whole lines" },
  { mark: "(words)", effect: "backing vocals or an echo of the lead" },
  { mark: "o-o-oh", effect: "stretch a vowel across several notes" },
] as const;

export const LYRIC_NOTATION_RULE =
  'Punctuation is performance: "..." for a breath or held note, an em dash for a sudden cut, CAPITALS on at most one or two words for strain, and (parentheses) for backing vocals. Use each only where it serves the line.';

// ---------------------------------------------------------------------------------------------
// Suno settings: a three-pass routine from community testing (not official Suno guidance)

export const SUNO_PASSES = [
  {
    name: "Explore",
    when: "First 2-4 takes of a new prompt",
    settings: "Weirdness 30-45 · Style Influence 85-90 · Variety low",
    why: "Holds Suno close to your prompt so you can tell whether the prompt itself works.",
  },
  {
    name: "Narrow",
    when: "When one take is close",
    settings: "Keep the seed take · edit the one weak section · same sliders",
    why: "Fix what's broken instead of rolling the dice on the whole song again.",
  },
  {
    name: "Final",
    when: "Once the arrangement is right",
    settings: "Max Mode on (where your plan has it) · one or two takes",
    why: "Spend the slower, higher-quality pass only on a song you already know works.",
  },
] as const;

// ---------------------------------------------------------------------------------------------
// Two versions of one style

type TwoFormat = { styleTag?: string; styleAlt?: string | undefined; styleFormat?: PromptFormat | undefined; styleBrief?: string | undefined };

/** The format the active style is in. */
export function activeFormat(r: TwoFormat | null | undefined): PromptFormat {
  if (!r) return "tags";
  return r.styleFormat ?? (looksLikeBrief(r.styleTag ?? "") ? "brief" : "tags");
}

/**
 * Folds a fresh AI result (tag list in styleTag, brief in styleBrief) into one active style
 * plus its alternative, with the person's preferred format active.
 */
export function arrangeFormats<T extends TwoFormat>(r: T, preferred: PromptFormat): T {
  const brief = r.styleBrief?.trim();
  const { styleBrief: _drop, ...rest } = r;
  if (!brief || !r.styleTag?.trim()) return { ...rest, styleFormat: activeFormat(r) } as T;
  return (preferred === "brief"
    ? { ...rest, styleTag: brief, styleAlt: r.styleTag, styleFormat: "brief" }
    : { ...rest, styleAlt: brief, styleFormat: "tags" }) as T;
}

/** Swaps the active style and its alternative. Lossless: edits to either side are kept. */
export function swapFormat<T extends TwoFormat>(r: T): T {
  if (!r.styleAlt) return r;
  const now = activeFormat(r);
  return { ...r, styleTag: r.styleAlt, styleAlt: r.styleTag ?? "", styleFormat: now === "brief" ? "tags" : "brief" };
}

/** After an AI rewrite of the active style, the alternative no longer matches; drop it. */
export function dropAlt<T extends TwoFormat>(r: T, styleTag: string): T {
  return { ...r, styleTag, styleAlt: undefined, styleFormat: looksLikeBrief(styleTag) ? "brief" : "tags" };
}
