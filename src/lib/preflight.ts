/**
 * Pre-flight check of a Suno style prompt, run before generating so fewer credits and
 * downloads are spent on takes that were never going to work. Pure and instant.
 */
import {
  ALL_GENRES,
  STYLE_TARGET_FOR_VERSION,
  SUNO_LIMITS,
  SUNO_VERSION_NAMES,
  findStyleLeaks,
  type SunoVersion,
} from "./suno";

export type PreflightIssue = { level: "stop" | "warn"; message: string };

const tagsOf = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

/** Word pairs that pull a generation in opposite directions. */
const OPPOSITES: Array<[RegExp, RegExp, string]> = [
  [/\b(slow|downtempo|ballad)\b/, /\b(fast|uptempo|high[- ]tempo|frantic)\b/, "slow and fast"],
  [/\b(calm|chill|mellow|soft|gentle|relaxed)\b/, /\b(aggressive|heavy|intense|brutal|explosive)\b/, "calm and aggressive"],
  [/\b(acoustic|unplugged)\b/, /\b(edm|electronic|synth[- ]heavy|dubstep)\b/, "acoustic and electronic"],
  [/\b(lo-?fi)\b/, /\b(polished|hi-?fi|crisp modern mix)\b/, "lo-fi and polished"],
  [/\b(minimal|sparse|stripped)\b/, /\b(wall of sound|dense|lush layers|orchestral)\b/, "sparse and dense"],
];

export function preflight(input: {
  style: string;
  exclude: string;
  version: SunoVersion;
  artistNames: string[];
}): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const style = input.style.trim();
  const lower = style.toLowerCase();
  const tags = tagsOf(style);
  const target = STYLE_TARGET_FOR_VERSION[input.version];

  if (!style) return [{ level: "stop", message: "There's no style prompt yet." }];

  if (style.length > SUNO_LIMITS.style) {
    issues.push({ level: "stop", message: `Style is ${style.length} characters; Suno's box takes ${SUNO_LIMITS.style}.` });
  } else if (style.length > target + 100) {
    issues.push({
      level: "warn",
      message: `Style is ${style.length} characters. ${SUNO_VERSION_NAMES[input.version]} works best around ${target}; extra tags dilute each other.`,
    });
  }

  if (tags.length > 20) {
    issues.push({ level: "warn", message: `${tags.length} tags is a lot. Suno tends to follow the first 8–12; cut the weakest.` });
  }

  const leaks = findStyleLeaks(style, input.artistNames);
  if (leaks.length) {
    issues.push({ level: "stop", message: `Artist names in the style (${leaks.join(", ")}). Suno blocks them; describe the sound instead.` });
  }

  const genres = ALL_GENRES.map((g) => g.toLowerCase());
  const genreAt = tags.findIndex((t) => genres.some((g) => t.includes(g)));
  if (genreAt > 2) {
    issues.push({ level: "warn", message: "The genre comes late. Put it first; Suno weighs the opening tags most." });
  }

  const bpms = [...lower.matchAll(/(\d{2,3})\s*bpm/g)].map((m) => m[1]);
  if (new Set(bpms).size > 1) {
    issues.push({ level: "warn", message: `More than one tempo (${[...new Set(bpms)].join(", ")} bpm). Pick one.` });
  }

  for (const [a, b, label] of OPPOSITES) {
    if (a.test(lower) && b.test(lower)) {
      issues.push({ level: "warn", message: `Mixed signals: ${label}. If that's intentional, say how (e.g. "slow verses, fast chorus").` });
    }
  }

  if (/\bmale vocals?\b/.test(lower.replace(/female/g, "")) && /\bfemale vocals?\b/.test(lower) && !/\bduet\b/.test(lower)) {
    issues.push({ level: "warn", message: 'Both male and female vocals. If you want two singers, say "duet".' });
  }

  const negatives = tags.filter((t) => /^(no|without|avoid|not)\b/.test(t));
  if (negatives.length) {
    issues.push({
      level: "warn",
      message: `"${negatives[0]}" is a negative inside the style box, where it can do the opposite. Move it to Exclude styles.`,
    });
  }

  const excluded = new Set(tagsOf(input.exclude));
  const both = tags.filter((t) => excluded.has(t));
  if (both.length) {
    issues.push({ level: "stop", message: `"${both[0]}" is in both the style and Exclude styles.` });
  }

  return issues;
}
