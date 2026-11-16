/**
 * Checks that need both boxes: section tags in the lyrics against the style. Suno follows a
 * section cue like [Whisper] only when the style allows it, and two voices only when the style
 * says "duet". Used by the Prompt Checker, Quick song's score and the Suno Sheet's pre-flight.
 */
import { looksLikeBrief } from "./prompt-craft";

export type LyricStyleFix = "addDuet";
export type LyricStyleIssue = { level: "warn" | "tip"; message: string; fix?: LyricStyleFix | undefined };

const SOFT = /\b(whisper(?:ed|ing|s)?|hushed|soft(?:ly)?|intimate|breathy|murmur(?:ed)?|tender|lullaby)\b/i;
const POWER = /\b(belt(?:ed|ing)?|anthemic|powerful|shout(?:ed|ing)?|scream(?:ed|ing)?|aggressive|stadium|full[- ]throated|roar(?:ing)?)\b/i;

/** The bracketed tag lines of the lyrics, e.g. "[Chorus | Belted | Full band]". */
export function tagLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[[^\]]+\]$/.test(l));
}

/** Who sings each tagged section, in order: "male", "female", "both" or null when unnamed. */
export function singersIn(tags: string[]): Array<"male" | "female" | "both" | null> {
  return tags.map((t) => {
    const x = t.toLowerCase();
    if (/\bduet\b/.test(x)) return "both";
    if (/\bfemale vocals?\b/.test(x)) return "female";
    if (/\bmale vocals?\b/.test(x)) return "male";
    return null;
  });
}

export function lyricStyleChecks(style: string, lyrics: string): LyricStyleIssue[] {
  const issues: LyricStyleIssue[] = [];
  const tags = tagLines(lyrics);
  if (!tags.length || !style.trim()) return issues;

  // Two voices need "duet" in the style.
  const singers = singersIn(tags).filter((s): s is "male" | "female" | "both" => s !== null);
  const set = new Set(singers);
  const two = set.has("both") || (set.has("male") && set.has("female"));
  if (two && !/\bduet\b/i.test(style)) {
    issues.push({
      level: "warn",
      message: "The lyrics switch between two singers, but the style doesn't say \"duet\". Suno uses two voices only when that word is in the style.",
      fix: "addDuet",
    });
  }
  const switches = singers.reduce((n, s, i) => (i > 0 && s !== singers[i - 1] ? n + 1 : n), 0);
  if (switches > 6) {
    issues.push({ level: "tip", message: `The singer changes ${switches} times. About 4 to 6 changes a song works best; more and the voices start to blur.` });
  }

  // Section cues that the style overrules.
  const styleSoft = SOFT.test(style);
  const stylePower = POWER.test(style);
  const softCue = tags.find((t) => SOFT.test(t));
  const powerCue = tags.find((t) => POWER.test(t));
  if (softCue && stylePower && !styleSoft) {
    issues.push({
      level: "warn",
      message: `${softCue} asks for a quiet voice, but the style only describes a big one (${style.match(POWER)![0]}). Suno usually ignores the cue. Add "intimate" or "soft verses" to the style, or drop the cue.`,
    });
  }
  if (powerCue && styleSoft && !stylePower) {
    issues.push({
      level: "warn",
      message: `${powerCue} asks for a big voice, but the style only describes a quiet one (${style.match(SOFT)![0]}). Add "belted chorus" to the style, or drop the cue.`,
    });
  }
  return issues;
}

/** Puts "duet" near the front of the style: second in a tag list, or a short sentence after the first in a brief. */
export function addDuet(style: string): string {
  if (/\bduet\b/i.test(style)) return style;
  const s = style.trim();
  if (looksLikeBrief(s)) {
    const end = s.search(/[.!?](\s|$)/);
    return end < 0 ? `${s} A male and female duet.` : `${s.slice(0, end + 1)} A male and female duet.${s.slice(end + 1)}`;
  }
  const tags = s.split(",").map((t) => t.trim()).filter(Boolean);
  return [tags[0], "duet", ...tags.slice(1)].filter(Boolean).join(", ");
}
