/**
 * Rhyme scheme analysis for lyrics, from spelling (no pronunciation dictionary), so it's a
 * good guess rather than exact. Finds the scheme of each section (AABB, ABAB…), which end
 * words rhyme perfectly or loosely, and flags the "rhyme trap": nearly every line ending on
 * a clean one-syllable perfect rhyme (arm/harm, door/more), which makes lyrics sound like
 * metered poetry instead of speech. Pure, so it's unit tested.
 */
import { countSyllables } from "./cliches";

export type RhymeStyle = "classic" | "loose" | "minimal" | "none";
export type LyricVoice = "polished" | "plain" | "raw";

export const RHYME_STYLES: Array<{ value: RhymeStyle; label: string; hint: string }> = [
  { value: "classic", label: "Classic rhymes", hint: "Clean end rhymes. Suits pop, country, musical theatre." },
  { value: "loose", label: "Loose rhymes", hint: "Slant and internal rhymes, some lines don't rhyme. Sounds less 'written'." },
  { value: "minimal", label: "Barely rhymes", hint: "Conversational; rhymes only where they land naturally. Good for emo, post-hardcore, indie." },
  { value: "none", label: "No rhymes", hint: "Free verse that still fits a beat." },
];

export const LYRIC_VOICES: Array<{ value: LyricVoice; label: string; hint: string }> = [
  { value: "polished", label: "Polished", hint: "Crafted imagery and wordplay." },
  { value: "plain", label: "Plainspoken", hint: "Everyday words, like someone talking." },
  { value: "raw", label: "Raw / unfiltered", hint: "Blunt, messy, diary-like. Allowed to be awkward or petty." },
];

/** The last sung word of a line: ad-libs in (brackets) and punctuation are ignored. */
export function endWord(line: string): string {
  const words = line
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g);
  return words?.[words.length - 1]?.replace(/'s$/, "") ?? "";
}

type Rime = { vowel: string; coda: string };

/**
 * The rhyming part of a word (last vowel sound + what follows), with common spellings of the
 * same sound folded together: door/more/four → OR, night/bite → I+t, rain/plane → AY+n.
 */
export function rime(word: string): Rime | null {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return null;
  // Whole-ending spellings first.
  const endings: Array<[RegExp, Rime]> = [
    [/(?:igh|ie|ye)$/, { vowel: "I", coda: "" }],
    [/(?:ight|ite|yte)$/, { vowel: "I", coda: "t" }],
    [/(?:oor|oar|ore|our)$/, { vowel: "OR", coda: "" }],
    [/(?:ue|ew|oo)$/, { vowel: "OO", coda: "" }],
    [/(?:ay|ey|eigh)$/, { vowel: "AY", coda: "" }],
    [/(?:ee|ea)$/, { vowel: "EE", coda: "" }],
    [/(?:ow|oe|o)$/, { vowel: "OH", coda: "" }],
  ];
  // Common spellings that look alike but sound different (heart ≠ hear, head ≠ bead).
  if (/eart$/.test(w)) return { vowel: "AR", coda: "t" };
  if (/^(?:bear|pear|wear|swear|there|where|their|care|stare|air|hair|chair|fair|pair|prayer)$/.test(w)) return { vowel: "AIR", coda: "" };
  if (/ear$/.test(w)) return { vowel: "EER", coda: "" };
  if (/ead$/.test(w) || w === "said") return /^(?:bead|plead|knead)$/.test(w) ? { vowel: "EE", coda: "d" } : { vowel: "EH", coda: "d" };
  if (/^(?:been|again|against)$/.test(w)) return { vowel: "EH", coda: "n" };
  if (/^(?:love|above|of|dove|shove|glove)$/.test(w)) return { vowel: "UH", coda: "v" };
  if (/^(?:come|some|done|none|one|won|son|from|blood|flood)$/.test(w)) {
    return { vowel: "UH", coda: w.endsWith("d") ? "d" : w.endsWith("m") || w.endsWith("me") ? "m" : "n" };
  }
  // "hour", "flour", "sour" aren't OR rhymes; "how", "now" aren't OH. Keep the common ones apart.
  if (/^(?:h|fl|s|d)?our$/.test(w) && w !== "four" && w !== "your" && w !== "pour") return { vowel: "OW", coda: "r" };
  if (/^(?:how|now|cow|wow|bow|vow|allow|somehow|anyhow)$/.test(w)) return { vowel: "OW", coda: "" };
  if (/^(?:do|to|who|you|two|through|into)$/.test(w)) return { vowel: "OO", coda: "" };
  for (const [re, r] of endings) if (re.test(w) && !(re.source.startsWith("(?:ow") && w.length < 2)) return r;
  // One-syllable "-or" words (for, nor) rhyme with door/more; longer ones (mirror, color) don't.
  if (/or$/.test(w) && countSyllables(w) === 1) return { vowel: "OR", coda: "" };
  // A consonant + y at the end of a one-syllable word sounds like "eye": cry, sky, fly.
  if (/[^aeiou]y$/.test(w)) return countSyllables(w) === 1 ? { vowel: "I", coda: "" } : { vowel: "EE", coda: "" };

  // Silent e makes the vowel before it long: time, home, plane, tune.
  let magic = false;
  if (/[^aeiou]e$/.test(w) && w.length > 3) {
    magic = true;
    w = w.slice(0, -1);
  }
  const m = /([aeiouy]+)([^aeiouy]*)$/.exec(w);
  if (!m) return null;
  let v = m[1]!;
  let coda = m[2]!.replace(/(.)\1+/g, "$1"); // "ll" → "l"
  coda = coda.replace(/^ck$/, "k").replace(/^c$/, "k");
  if (magic) {
    v = { a: "AY", e: "EE", i: "I", y: "I", o: "OH", u: "OO" }[v] ?? v;
  } else {
    const map: Record<string, string> = {
      ai: "AY", ay: "AY", ei: "AY", ee: "EE", ea: "EE", ie: "EE", oa: "OH", oo: "OO", ou: "OU", ow: "OU", oi: "OY", oy: "OY", au: "AW", aw: "AW",
    };
    if (map[v]) v = map[v]!;
    else if (coda.startsWith("r")) {
      // r after a short vowel colours it: car/star → AR, her/sir/fur → ER, for/born → OR.
      // In longer words a final -or/-ar/-er is usually unstressed (mirror, sugar, river) → ER.
      const weakEnding = coda === "r" && countSyllables(word) > 1;
      v = weakEnding ? "ER" : ({ a: "AR", o: "OR", e: "ER", i: "ER", u: "ER", y: "ER" }[v] ?? v);
      coda = coda.slice(1);
    } else {
      v = { a: "A", e: "EH", i: "IH", o: "O", u: "UH", y: "IH" }[v] ?? v;
    }
  }
  if (coda === "gh") coda = "";
  return { vowel: v, coda };
}

export type RhymeKind = "perfect" | "near" | "repeat" | "none";

export function rhymeKind(a: string, b: string): RhymeKind {
  if (!a || !b) return "none";
  if (a === b) return "repeat";
  const ra = rime(a);
  const rb = rime(b);
  if (!ra || !rb || ra.vowel !== rb.vowel) return "none";
  return ra.coda === rb.coda ? "perfect" : "near";
}

export type LineRhyme = {
  word: string;
  /** Scheme letter (A, B, C…); lines with the same letter rhyme. Empty for blank lines. */
  letter: string;
  /** How this line's end word rhymes with the earlier line it matches. */
  kind: RhymeKind;
  oneSyllable: boolean;
};

export type SectionRhyme = {
  lines: LineRhyme[];
  /** e.g. "AABB". */
  scheme: string;
  /** Share of lines whose end word perfectly rhymes with another line in the section. */
  perfectShare: number;
  /** Nearly every line ends on a clean one-syllable perfect rhyme. */
  trap: boolean;
};

export function analyzeSection(lineTexts: string[]): SectionRhyme {
  const words = lineTexts.map(endWord);
  const letters: string[] = [];
  const kinds: RhymeKind[] = [];
  let next = 0;
  words.forEach((w, i) => {
    if (!w) {
      letters.push("");
      kinds.push("none");
      return;
    }
    let found = -1;
    let kind: RhymeKind = "none";
    // Prefer a perfect match with any earlier line, then a near one.
    for (const wanted of ["perfect", "repeat", "near"] as RhymeKind[]) {
      for (let j = i - 1; j >= 0; j--) {
        if (words[j] && rhymeKind(w, words[j]!) === wanted) {
          found = j;
          kind = wanted;
          break;
        }
      }
      if (found >= 0) break;
    }
    if (found >= 0) {
      letters.push(letters[found]!);
      kinds.push(kind);
    } else {
      letters.push(String.fromCharCode(65 + (next++ % 26)));
      kinds.push("none");
    }
  });

  // A line counts as "in a perfect rhyme" if it perfectly rhymes with any other line.
  const inPerfect = words.map(
    (w, i) => !!w && words.some((o, j) => j !== i && !!o && rhymeKind(w, o) === "perfect"),
  );
  const sung = words.filter(Boolean).length;
  const perfectCount = inPerfect.filter(Boolean).length;
  const perfectShare = sung ? perfectCount / sung : 0;
  const oneSylPerfect = words.filter((w, i) => inPerfect[i] && countSyllables(w) === 1).length;
  const trap = sung >= 4 && perfectShare >= 0.75 && oneSylPerfect / sung >= 0.5;

  return {
    lines: words.map((w, i) => ({
      word: w,
      letter: letters[i]!,
      kind: kinds[i]!,
      oneSyllable: !!w && countSyllables(w) === 1,
    })),
    scheme: letters.filter(Boolean).join(""),
    perfectShare,
    trap,
  };
}

/** Prompt rules for the chosen rhyme style and voice (empty for the defaults). */
export function lyricStyleRules(rhyme: unknown, voice: unknown): string {
  const r = typeof rhyme === "string" ? rhyme : "classic";
  const v = typeof voice === "string" ? voice : "polished";
  const rules: string[] = [];
  if (r === "loose")
    rules.push(
      "RHYME: avoid the AABB/ABAB perfect-rhyme trap. Prefer slant rhymes, assonance and internal rhymes. At most a third of line endings may be perfect one-syllable rhymes (like arm/harm, door/more); let some lines not rhyme at all.",
    );
  if (r === "minimal")
    rules.push(
      "RHYME: mostly unrhymed and conversational. Rhyme only where it lands naturally, at most once or twice per section. Never pair clean one-syllable perfect rhymes (arm/harm, door/more, out/mouth). Lines should sound like speech that happens to fit the beat, not poetry written to a meter.",
    );
  if (r === "none")
    rules.push("RHYME: no end rhymes at all. Free verse that still scans to the beat; use repetition, not rhyme, for the hook.");
  if (v === "plain")
    rules.push(
      "VOICE: plainspoken. Everyday words, contractions, short sentences, few metaphors, no poetic word order, nothing a person wouldn't actually say.",
    );
  if (v === "raw")
    rules.push(
      "VOICE: raw and unfiltered, like a frustrated diary entry or a voice memo at 2am. Blunt statements, run-on lines, uneven line lengths, a phrase repeated for emphasis, specific mundane details (a text left on read, a parking lot, a borrowed hoodie). It may be awkward, petty or contradictory. No wisdom, no tidy resolution, no clever wordplay, no grand imagery.",
    );
  return rules.length ? `\n${rules.join("\n")}` : "";
}
