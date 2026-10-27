/**
 * Pre-release checks for a Suno song. Band Blender doesn't distribute anything; this helps
 * people answer their distributor's questions honestly and catch what gets releases pulled.
 * Rules summarised from distributor and platform guidance as of October 2026; they change,
 * so the UI links people to check current terms.
 */
import type { AiLevel, ForgeState } from "@/components/forge/types";
import { latestLyricCheck } from "@/lib/song-status";

export const AI_LEVELS: Array<{ value: AiLevel; label: string; hint: string }> = [
  { value: "none", label: "No AI", hint: "Made entirely by people." },
  { value: "assisted", label: "AI-assisted", hint: "A person made it; AI helped with parts or ideas." },
  { value: "mostly", label: "Mostly AI", hint: "AI made it; a person chose, edited or rewrote parts." },
  { value: "all", label: "All AI", hint: "AI made it and it was used as is." },
];

export type DisclosurePart = "lyrics" | "music" | "vocals" | "artwork";

export const DISCLOSURE_QUESTIONS: Array<{ part: DisclosurePart; question: string; why: string }> = [
  { part: "lyrics", question: "Who wrote the lyrics?", why: "Lyric Forge counts as AI help; your own edits move it toward \"assisted\"." },
  { part: "music", question: "Who made the music (melody, beat, arrangement)?", why: "Anything Suno generated is AI-made, even when your prompt shaped it." },
  { part: "vocals", question: "Whose voice is singing?", why: "A Suno voice is AI. Your own recorded voice is not, even if Suno processed it." },
  { part: "artwork", question: "How was the cover made?", why: "AI-generated images count, even if you added the text yourself." },
];

/** Sensible starting answers from what the app knows; the person confirms or changes them. */
export function suggestDisclosure(state: ForgeState): Partial<Record<DisclosurePart, AiLevel>> {
  const forged = state.lyrics.sections.some((s) => s.lines.length > 0) && !state.lyrics.tagsOnly;
  return {
    ...(forged ? { lyrics: "mostly" as const } : {}),
    music: "all",
    vocals: "all",
  };
}

const any = (l: AiLevel | undefined) => Boolean(l && l !== "none");

/** Plain answers to the questions distributors and stores ask, from the four levels. */
export function disclosureAnswers(d: Partial<Record<DisclosurePart, AiLevel>>): Array<{ where: string; answer: string }> {
  if (!d.lyrics || !d.music || !d.vocals || !d.artwork) return [];
  const audioAll = d.music === "all" && d.vocals === "all";
  const audioAny = any(d.music) || any(d.vocals);
  const name = (l: AiLevel) => AI_LEVELS.find((x) => x.value === l)!.label.toLowerCase();
  return [
    {
      where: "DistroKid AI credits",
      answer: [
        any(d.lyrics) ? "AI contributed to the lyrics" : "No AI in the lyrics",
        any(d.music) ? "AI contributed to the music" : "No AI in the music",
        audioAll ? "AI generated all of the audio" : audioAny ? "AI generated part of the audio" : "No AI-generated audio",
      ].join("; "),
    },
    {
      where: "Apple Music transparency tags",
      answer: [
        `Track audio: ${audioAll ? "AI-generated" : audioAny ? "partly AI-generated" : "no AI"}`,
        `Composition: ${any(d.lyrics) || any(d.music) ? "AI involved" : "no AI"}`,
        `Artwork: ${any(d.artwork) ? "AI involved" : "no AI"}`,
      ].join("; "),
    },
    {
      where: "Other distributors",
      answer: `Lyrics ${name(d.lyrics)}, music ${name(d.music)}, vocals ${name(d.vocals)}, artwork ${name(d.artwork)}. Use the closest option they offer, and when unsure, pick the one with more AI.`,
    },
  ];
}

export type AutoCheck = { id: string; label: string; ok: boolean | null; detail: string; tab?: string };

/** Real artist names in the title or lyrics read as impersonation to stores. */
export function artistNameHits(state: ForgeState): string[] {
  const names = state.blend.artists.map((a) => a.trim()).filter((a) => a.length >= 3);
  if (!names.length) return [];
  const text = [state.lyrics.title, ...state.lyrics.sections.flatMap((s) => s.lines.map((l) => l.text))].join("\n").toLowerCase();
  return names.filter((n) => new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

export function autoChecks(state: ForgeState): AutoCheck[] {
  const hits = artistNameHits(state);
  const lyric = latestLyricCheck(state.takes);
  // Lyrics count if they're in Lyric Forge or were pasted into a lyric check.
  const hasLyrics = state.lyrics.sections.some((s) => s.lines.length > 0) || Boolean(lyric);
  const missing = lyric?.issues.filter((i) => i.status === "missing").length ?? 0;
  const cover = state.release?.cover;
  return [
    {
      id: "names",
      label: "No real artist names in the title or lyrics",
      ok: hits.length === 0,
      detail: hits.length ? `Found: ${hits.join(", ")}. Stores treat this as impersonation; describe the sound instead.` : "None of the artists you blended appear.",
      tab: "lyrics",
    },
    {
      id: "lyrics",
      label: "Suno sang the lyrics you wrote",
      ok: !hasLyrics ? true : lyric ? missing === 0 && lyric.accuracyPct >= 85 : null,
      detail: !hasLyrics
        ? "No lyrics in this song."
        : lyric
          ? `${lyric.accuracyPct}% as written${missing ? `, ${missing} line(s) not heard` : ""}.`
          : "Not checked yet. Static lyrics you submit should match what's sung.",
      tab: "lyriccheck",
    },
    {
      id: "master",
      label: "Mastered for streaming",
      ok: state.release?.masteredAt ? true : null,
      detail: state.release?.masteredAt ? "A master was exported." : "Not mastered here yet (fine if you mastered elsewhere).",
      tab: "master",
    },
    {
      id: "cover",
      label: "Cover is 3000×3000 with no links or logos",
      ok: cover ? cover.size >= 3000 : null,
      detail: cover ? `Made in Cover Maker at ${cover.size}×${cover.size}.` : "No cover made here yet.",
      tab: "cover",
    },
  ];
}

/** Manual items people tick themselves (stored in release.ticks). */
export const MANUAL_CHECKS: Array<{ id: string; label: string; detail: string }> = [
  {
    id: "plan",
    label: "I made the song on a paid Suno plan",
    detail: "Songs made on the free plan are for non-commercial use, and subscribing later doesn't change that for songs already made.",
  },
  {
    id: "downloaded",
    label: "I downloaded it from Suno myself",
    detail: "Suno only allows commercial use of songs downloaded through its own download button; recording or ripping isn't allowed.",
  },
  {
    id: "voice",
    label: "No real person's voice is imitated without written consent",
    detail: "Sound-alikes of real singers get removed everywhere.",
  },
  {
    id: "distributor",
    label: "My distributor accepts AI music",
    detail: "As of Oct 2026: DistroKid, UnitedMasters and Amuse accept it with conditions; CD Baby doesn't accept AI-generated recordings; Deezer tags AI tracks and leaves them out of recommendations.",
  },
  {
    id: "no-spam",
    label: "I'm not uploading lots of near-identical tracks",
    detail: "Mass uploads and duplicate titles trigger spam filters on Spotify and distributors.",
  },
];
