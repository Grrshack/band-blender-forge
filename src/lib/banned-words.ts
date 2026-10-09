/**
 * User-defined lyric blacklist ("don't use alone, voice, ..."). Pure, so it runs
 * on the server, in the browser and in tests.
 */

/** Splits a comma/newline list into unique, trimmed, lowercase words or phrases. */
export function parseBannedWords(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out = raw
    .split(/[,\n;]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0 && w.length <= 40);
  return [...new Set(out)].slice(0, 50);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Banned words/phrases found in `text` as whole words (also catches simple plurals: voice → voices). */
export function findBannedWords(text: string, banned: string[]): string[] {
  if (!text || !banned.length) return [];
  const hits: string[] = [];
  for (const w of banned) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(w)}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(text)) hits.push(w);
  }
  return hits;
}

/** Prompt instruction for the model; empty when no words are banned. */
export function bannedWordsInstruction(banned: string[]): string {
  if (!banned.length) return "";
  return `\nHARD BAN — the user forbids these words and phrases (including plurals and close variants). Do NOT use them anywhere in any lyric line: ${banned.map((w) => `"${w}"`).join(", ")}.`;
}
