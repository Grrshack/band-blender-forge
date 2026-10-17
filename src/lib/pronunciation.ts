/**
 * Things AI singers often say wrong. Suno sings what it reads, so digits, symbols,
 * abbreviations and words with two pronunciations are the usual culprits. Each risk
 * comes with a suggested respelling the person can paste in.
 */
export type PronunciationRisk = { word: string; why: string; suggestion: string };

const SYMBOLS: Record<string, string> = {
  "&": "and",
  "%": "percent",
  "@": "at",
  "+": "plus",
  "#": "number",
  $: "dollars",
};

/** Same spelling, different sound. Only words where the wrong one changes the meaning. */
const HETERONYMS: Record<string, string> = {
  live: '"liv" (to live) or "lyve" (live show)',
  lives: '"livs" (he lives) or "lyves" (nine lives)',
  read: '"reed" (now) or "red" (already)',
  lead: '"leed" (to lead) or "led" (the metal)',
  tear: '"teer" (crying) or "tair" (to rip)',
  tears: '"teers" (crying) or "tairs" (rips)',
  wind: '"wind" (the breeze) or "wynd" (to wind up)',
  wound: '"woond" (an injury) or "wownd" (wound up)',
  bass: '"base" (low notes) or "bass" (the fish)',
  bow: '"boh" (a ribbon) or "bau" (to bend)',
  dove: '"duhv" (the bird) or "dohv" (dived)',
  desert: '"DEZ-ert" (sand) or "de-ZERT" (to abandon)',
  minute: '"MIN-it" (time) or "my-NOOT" (tiny)',
  close: '"kloze" (to shut) or "klohss" (nearby)',
};

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Spells out 0–9999 the way it's usually sung; larger numbers are left as a hint. */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n);
  if (n < 20) return NUMBER_WORDS[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${NUMBER_WORDS[n % 10]}` : "");
  // Years and 4-digit numbers are sung in pairs: 1999 → "nineteen ninety-nine".
  if (n >= 1100 && n <= 9999 && n % 1000 >= 10) {
    const hi = Math.floor(n / 100);
    const lo = n % 100;
    return `${numberToWords(hi)} ${lo === 0 ? "hundred" : lo < 10 ? `oh-${NUMBER_WORDS[lo]}` : numberToWords(lo)}`;
  }
  if (n < 1000) {
    const rest = n % 100;
    return `${NUMBER_WORDS[Math.floor(n / 100)]} hundred${rest ? ` ${numberToWords(rest)}` : ""}`;
  }
  return "spell it out";
}

/** Common short forms that are said as words, not letters, or are already sung correctly. */
const SAFE_CAPS = new Set(["I", "OK", "TV", "USA", "NASA", "LA", "NY", "UFO", "AM", "PM"]);

export function findPronunciationRisks(line: string): PronunciationRisk[] {
  const risks: PronunciationRisk[] = [];
  const seen = new Set<string>();
  const add = (r: PronunciationRisk) => {
    if (seen.has(r.word)) return;
    seen.add(r.word);
    risks.push(r);
  };

  // 24/7, 9-5, 3am, 1999, 2nd …
  for (const m of line.matchAll(/\b\d+(?:[/:-]\d+)?(?:st|nd|rd|th|am|pm|s)?\b/gi)) {
    const token = m[0];
    const parts = token.match(/\d+/g) ?? [];
    const words = parts.map((p) => numberToWords(Number(p)));
    const suffix = /am$/i.test(token) ? " A.M." : /pm$/i.test(token) ? " P.M." : "";
    add({
      word: token,
      why: "Numbers in digits are often read out oddly or skipped.",
      suggestion: `${words.join(" ")}${suffix}`,
    });
  }

  for (const [sym, said] of Object.entries(SYMBOLS)) {
    if (line.includes(sym))
      add({ word: sym, why: "Symbols are often skipped or read literally.", suggestion: said });
  }

  // Abbreviations in capitals (DJ, FBI) get sung as a word; separating the letters helps.
  for (const m of line.matchAll(/\b[A-Z]{2,5}\b/g)) {
    const w = m[0];
    if (SAFE_CAPS.has(w)) continue;
    add({
      word: w,
      why: "Capital-letter abbreviations can be sung as one word.",
      suggestion: w.split("").join("."),
    });
  }

  for (const m of line.matchAll(/\b[a-z]+\b/gi)) {
    const w = m[0].toLowerCase();
    const hint = HETERONYMS[w];
    if (hint) {
      add({
        word: m[0],
        why: "Spelled the same, said two ways. Suno may pick the wrong one.",
        suggestion: `If it comes out wrong, respell it: ${hint}.`,
      });
    }
  }
  return risks;
}
