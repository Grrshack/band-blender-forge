/**
 * Band Blender's fixed content: slider meanings, the demo result, quick-start presets,
 * Reimagine genres, and the "Copy for Suno" formatter. Kept out of the component file.
 */
import type { BlendResult } from "@/components/forge/types";
import { vocalString } from "@/lib/suno";

export const SLIDERS = [
  {
    key: "energy",
    label: "Energy",
    hint: "How intense and driving the track feels — low is sparse and restrained, high is aggressive and relentless.",
  },
  {
    key: "complexity",
    label: "Complexity",
    hint: "How intricate the arrangement is — low is simple and repetitive, high is layered and technical.",
  },
  {
    key: "brightness",
    label: "Brightness",
    hint: "The overall tonal character — low is dark and bass-heavy, high is crisp and shimmering.",
  },
] as const;

export const DEMO = ["Portishead", "Massive Attack", "FKA twigs"];

/** Pre-computed demo result shown before the user runs their first blend. */
export const DEMO_BLEND: BlendResult = {
  confidence: { level: "high", note: "Demo result — replace with your own artists above" },
  genre: "Trip-hop / Art Pop",
  tempo: "70–88 BPM, dragging half-time feel",
  instrumentation: "Samplers, live strings, sub-heavy 808s, orchestral stabs, Rhodes piano",
  vocals: "Breathy alto, close-miked, intimate phrasing with occasional processed falsetto",
  mood: "Melancholic, cinematic, unsettled intimacy",
  styleTag:
    "trip-hop, dark art-pop, cinematic mood, 80bpm, sub bass, orchestral samples, breathy alto, lo-fi production, melancholic, introspective",
  vocalPrompt: {
    voice: "Warm breathy alto with restrained upper range",
    delivery: "Close-miked, half-spoken verses building to a contained belted chorus",
    harmonies: "Sparse high harmonics, single tracked at key phrase endings",
    effects: "Tape saturation, subtle pitch correction, long reverb tail on sustains",
  },
  excludeStyles: "euphoric, energetic, upbeat, acoustic folk, bright mix, arena rock",
  reconciliation:
    "The first artist's jazz-tinged sample manipulation and the second's dub-influenced sub pressure form the rhythmic foundation, while the third's avant-garde production sensibility — negative space and textural contrast — governs arrangement decisions. Vocal approach conflicts are resolved by favouring intimacy over cinematic distance, while keeping dense layering intact underneath.",
  recommendedSliders: { energy: 35, complexity: 72, brightness: 28 },
  sliderNotes: "Low energy and brightness reflect the slow, dark character; high complexity captures the layered production.",
};

export const PRESETS: { label: string; emoji: string; artists: string[] }[] = [
  { label: "Dark Cinematic Trap", emoji: "🌑", artists: ["James Blake", "Travis Scott", "Arca"] },
  { label: "90s Grunge Revival", emoji: "🎸", artists: ["Nirvana", "Hole", "Pixies"] },
  { label: "Hyperpop", emoji: "⚡", artists: ["100 gecs", "Charli XCX", "SOPHIE"] },
  { label: "Lo-fi Jazz Hip-hop", emoji: "🌿", artists: ["Nujabes", "J Dilla", "Toro y Moi"] },
  { label: "Orchestral Metal", emoji: "🔥", artists: ["Rammstein", "Hans Zimmer", "Gojira"] },
];

/** Formats blend output into one pasteable block for Suno's custom mode. */
export function formatForSuno(result: BlendResult): string {
  const parts: string[] = [];
  if (result.styleTag) parts.push(`Style: ${result.styleTag}`);
  const vocal = vocalString(result.vocalPrompt);
  if (vocal) parts.push(`Vocal style: ${vocal}`);
  if (result.excludeStyles) parts.push(`Exclude: ${result.excludeStyles}`);
  if (result.voiceTags) parts.push(`Voice tags (paste at top of lyrics): ${result.voiceTags}`);
  return parts.join("\n\n");
}

/** Genres offered for "Reimagine". Plain genre words only, no artist names. */
export const REIMAGINE_GENRES = [
  "Acoustic",
  "Synthwave",
  "Lo-fi hip-hop",
  "Orchestral",
  "Punk rock",
  "Jazz",
  "Country",
  "Reggaeton",
  "Drum and bass",
  "Gospel",
];
