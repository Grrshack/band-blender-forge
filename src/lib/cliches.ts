/**
 * Lyric cliché enforcement + syllable estimates. Pure: runs on the server (to
 * auto-rewrite offending lines) and in the browser (to flag lines live as the
 * user edits).
 */

/** Worn-out phrases that AI lyrics reach for. Matched as whole phrases, case- and punctuation-insensitive. */
export const BANNED_PHRASES: readonly string[] = [
  "neon lights",
  "neon glow",
  "concrete jungle",
  "shadows dance",
  "shadows dancing",
  "broken wings",
  "burning bright",
  "fading light",
  "we are the ones",
  "chasing dreams",
  "chasing shadows",
  "heart of gold",
  "tears like rain",
  "rise from the ashes",
  "electric feel",
  "whispers in the wind",
  "whispers of the past",
  "echoes of",
  "tapestry of",
  "dance in the rain",
  "dancing in the rain",
  "set me free",
  "break the chains",
  "breaking the chains",
  "fire in my soul",
  "fire in my heart",
  "fire in your eyes",
  "spread my wings",
  "wings to fly",
  "sea of stars",
  "painted sky",
  "shattered dreams",
  "shattered glass",
  "hearts collide",
  "walking through fire",
  "light in the darkness",
  "light in the dark",
  "into the unknown",
  "weight of the world",
  "ghosts of the past",
  "city that never sleeps",
  "under the moonlight",
  "silver moon",
  "moonlit night",
  "fading away",
  "lost in the night",
  "lost in your eyes",
  "stars align",
  "stars collide",
  "rhythm of my heart",
  "beat of my heart",
  "dreams come true",
  "against all odds",
  "hand in hand",
  "eyes like fire",
  "soul on fire",
  "embers of",
  "dust and ashes",
  "rise like a phoenix",
  "kaleidoscope of",
  "symphony of",
  "dance with the devil",
  "demons inside",
  "fight the darkness",
  "through the storm",
  "weather the storm",
  "reach for the sky",
  "reach for the stars",
  "hearts on fire",
  "burning desire",
  "endless night",
  "eternal flame",
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const NORMALIZED = BANNED_PHRASES.map((p) => ({ phrase: p, norm: ` ${normalize(p)} ` }));

/** Banned phrases found in one line (empty = clean). */
export function findCliches(line: string): string[] {
  const hay = ` ${normalize(line)} `;
  return NORMALIZED.filter((p) => hay.includes(p.norm)).map((p) => p.phrase);
}

/** Prompt-ready list (capped so the prompt stays small). */
export function bannedListForPrompt(max = 40): string {
  return BANNED_PHRASES.slice(0, max)
    .map((p) => `"${p}"`)
    .join(", ");
}

/* ------------------------------------------------------------------ */
/* Fix loop                                                            */
/* ------------------------------------------------------------------ */

export type ClicheHit = { si: number; li: number; line: string; phrase: string };
export type LyricBlock = { lines: string[]; locked?: boolean[] | undefined };
export type Rewrite = { si: number; li: number; line: string };

/** Lines containing a banned phrase. Locked lines are the user's choice and are never flagged. */
export function findClicheHits(blocks: LyricBlock[]): ClicheHit[] {
  const hits: ClicheHit[] = [];
  blocks.forEach((b, si) =>
    b.lines.forEach((line, li) => {
      if (b.locked?.[li]) return;
      const found = findCliches(line);
      if (found.length) hits.push({ si, li, line, phrase: found[0]! });
    }),
  );
  return hits;
}

/**
 * Asks `rewrite` once for replacements of every offending line and applies only
 * the ones that are actually clean. Returns the new blocks plus what is still flagged.
 */
export async function fixCliches(
  blocks: LyricBlock[],
  rewrite: (hits: ClicheHit[]) => Promise<Rewrite[]>,
): Promise<{ blocks: LyricBlock[]; remaining: ClicheHit[] }> {
  const hits = findClicheHits(blocks);
  if (!hits.length) return { blocks, remaining: [] };

  let rewrites: Rewrite[] = [];
  try {
    rewrites = await rewrite(hits);
  } catch {
    /* keep the originals; the UI still flags them */
  }

  const next = blocks.map((b) => ({ ...b, lines: [...b.lines] }));
  for (const r of rewrites) {
    const hit = hits.find((h) => h.si === r.si && h.li === r.li);
    if (!hit || typeof r.line !== "string" || !r.line.trim()) continue;
    if (findCliches(r.line).length) continue;
    next[r.si]!.lines[r.li] = r.line.trim();
  }
  return { blocks: next, remaining: findClicheHits(next) };
}

/* ------------------------------------------------------------------ */
/* Syllables                                                           */
/* ------------------------------------------------------------------ */

const EXCEPTIONS: Record<string, number> = {
  every: 2,
  evening: 2,
  different: 2,
  family: 3,
  camera: 3,
  chocolate: 2,
  business: 2,
  interesting: 3,
  beautiful: 3,
  poem: 2,
  real: 1,
  really: 2,
  being: 2,
  fire: 1,
  hour: 1,
  our: 1,
  queen: 1,
  quiet: 2,
  science: 2,
  create: 2,
  idea: 3,
  area: 3,
  ocean: 2,
  radio: 3,
  video: 3,
  lion: 2,
  violin: 3,
  giant: 2,
  diamond: 2,
  lonely: 2,
  mountain: 2,
  heaven: 2,
  seven: 2,
  even: 2,
  over: 2,
  never: 2,
  ever: 2,
};

function wordSyllables(raw: string): number {
  // Numerals are sung as words ("6:10" = "six ten"): roughly one syllable per digit, capped at four.
  const numerals = (raw.match(/\d+/g) ?? []).reduce((n, run) => n + Math.min(run.length, 4), 0);

  let w = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return numerals;
  if (EXCEPTIONS[w] !== undefined) return numerals + EXCEPTIONS[w]!;
  if (w.length <= 3) return numerals + 1;
  // "go-ing", "play-ing": a vowel before -ing is its own syllable, not a diphthong
  w = w.replace(/([aeiouy])(ing)$/, "$1 $2");
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return numerals + Math.max(1, groups ? groups.length : 1);
}

/** Rough English syllable count (±1 per line). Ignores [bracketed cues] and (ad-libs). */
export function countSyllables(line: string): number {
  return line
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s-]+/)
    .reduce((n, w) => n + wordSyllables(w), 0);
}

/** True when a line is far from the section's typical length (needs ≥3 lines to judge). */
export function isSyllableOutlier(counts: number[], index: number, tolerance = 4): boolean {
  const live = counts.filter((c) => c > 0);
  if (live.length < 3 || !counts[index]) return false;
  const sorted = [...live].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return Math.abs(counts[index]! - median) >= tolerance;
}
