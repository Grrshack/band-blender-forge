/**
 * The free Suno prompt checker (/tools/suno-prompt-checker): scores a pasted title, style,
 * exclude list and lyrics with the same rules the Suno Sheet's pre-flight uses, plus a few
 * extra checks for prompts written by hand. No AI, nothing leaves the browser. Pure, so it's
 * unit tested, and every one-click fix is a plain text change the person can see.
 */
import { GENRE_CARDS } from "./genre-cards";
import { SEED_BUCKETS } from "./lab";
import { checkLyrics } from "./lyric-check";
import { preflight } from "./preflight";
import { COMMON_EXCLUDES, exportLyrics, hasCleanEnding, looksLikeBrief, mergeExcludes, placeVocal } from "./prompt-craft";
import { SUNO_LIMITS, findStyleLeaks, fitToLimit, scrubArtistNames, type SunoVersion } from "./suno";
import type { Section } from "@/components/forge/types";

export type CheckerInput = {
  title: string;
  style: string;
  exclude: string;
  lyrics: string;
  /** Artists the person had in mind, so their names are caught too (optional). */
  artists: string[];
  version: SunoVersion;
};

export type CheckerFix =
  | "removeNames"
  | "placeVocal"
  | "cleanEnding"
  | "addExcludes"
  | "moveNegatives"
  | "removeFluff"
  | "trimStyle";

export type CheckerBox = "Style" | "Exclude" | "Lyrics" | "Title";

export type CheckerIssue = {
  box: CheckerBox;
  /** stop: Suno will reject or ignore it. warn: likely to hurt the song. tip: easy win. */
  level: "stop" | "warn" | "tip";
  message: string;
  fix?: CheckerFix | undefined;
};

export type CheckerReport = {
  /** 0–100; null when there's no style to check yet. */
  score: number | null;
  verdict: string;
  issues: CheckerIssue[];
  counts: { title: number; style: number; exclude: number; lyrics: number };
};

export const FIX_LABELS: Record<CheckerFix, string> = {
  removeNames: "Remove the names",
  placeVocal: "Put the vocal upfront",
  cleanEnding: "Add a clean ending",
  addExcludes: "Add common excludes",
  moveNegatives: "Move them to Exclude",
  removeFluff: "Remove them",
  trimStyle: "Trim to 1,000",
};

/** Well-known names from the genre cards and Lab lanes, checked on top of "in the style of …". */
export const KNOWN_ARTISTS: string[] = [
  ...new Set([...GENRE_CARDS.flatMap((c) => c.exampleBlends.flatMap((b) => b.artists)), ...SEED_BUCKETS.flatMap((b) => b.artists)]),
];

const namesFor = (input: CheckerInput) => [...new Set([...input.artists.map((a) => a.trim()).filter(Boolean), ...KNOWN_ARTISTS])];

const tagsOf = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** Praise words describe how good it should be, not how it sounds; Suno can't hear them. */
const FLUFF =
  /^(?:amazing|awesome|incredible|best|perfect|masterpiece|good|great|nice|cool|beautiful song|hit|hit song|banger|viral|trending|catchy hit|(?:very )?high[- ]quality|hq|professional(?: quality| production)?|studio[- ]quality|radio[- ]ready|grammy[- ]worthy|award[- ]winning|top 40 hit)$/i;

const NEGATIVE_TAG = /^(?:no|without|avoid|not)\s+(.+)$/i;

const HAS_TEMPO = /\b\d{2,3}\s*bpm\b|\btempo\b|\bslow\b|\bmid-?tempo\b|\bup-?tempo\b|\bfast\b|\bdowntempo\b|\bhalf-?time\b|\bdouble-?time\b|\bdriving\b|\blaid-?back\b|\bballad\b/i;
const HAS_VOCAL = /\bvocals?\b|\bvoice\b|\bsinger\b|\bsung\b|\brap(?:s|ped|per|ping)?\b|\bchoir\b|\bcroon|\bfalsetto\b|\bvox\b|\bduet\b|\binstrumental\b|\bspoken\b|\bharmonies\b/i;
const TAG_LINE = /^\s*\[[^\]]+\]\s*$/;

function fluffTags(style: string): string[] {
  return looksLikeBrief(style) ? [] : tagsOf(style).filter((t) => FLUFF.test(t));
}

function negativeTags(style: string): string[] {
  return looksLikeBrief(style) ? [] : tagsOf(style).filter((t) => NEGATIVE_TAG.test(t));
}

export function checkPrompt(input: CheckerInput): CheckerReport {
  const style = input.style.trim();
  const exclude = input.exclude.trim();
  const lyrics = input.lyrics.replace(/\r/g, "").trim();
  const title = input.title.trim();
  const names = namesFor(input);
  const issues: CheckerIssue[] = [];
  const counts = { title: title.length, style: style.length, exclude: exclude.length, lyrics: lyrics.length };

  if (!style) {
    return { score: null, verdict: "Paste a style prompt to check it.", issues: [], counts };
  }

  // Style: the Suno Sheet's own pre-flight, with fixes this page can do.
  const negatives = negativeTags(style);
  for (const i of preflight({ style, exclude, version: input.version, artistNames: names })) {
    let fix: CheckerFix | undefined = i.fix;
    if (!fix && style.length > SUNO_LIMITS.style && /^Style is \d+ characters; Suno's box/.test(i.message)) fix = "trimStyle";
    if (!fix && negatives.length && /is a negative inside the style box/.test(i.message)) fix = "moveNegatives";
    const box: CheckerBox = /both the style and Exclude/.test(i.message) ? "Exclude" : "Style";
    issues.push({ box, level: i.level, message: i.message, ...(fix ? { fix } : {}) });
  }

  const fluff = fluffTags(style);
  if (fluff.length) {
    issues.push({
      box: "Style",
      level: "warn",
      message: `Praise words (${fluff.slice(0, 3).join(", ")}) don't describe a sound, so Suno can't use them. Spend those characters on instruments, tempo or texture.`,
      fix: "removeFluff",
    });
  }
  if (!HAS_TEMPO.test(style)) {
    issues.push({ box: "Style", level: "tip", message: "No tempo or pace. Add a BPM (\"92 BPM\") or a feel (\"laid-back\", \"driving\")." });
  }
  if (!HAS_VOCAL.test(style)) {
    issues.push({
      box: "Style",
      level: "tip",
      message: "No vocal described. Say who sings and how (\"raspy male vocal, upfront\"), or write \"instrumental\".",
    });
  }

  // Exclude
  if (exclude.length > SUNO_LIMITS.exclude) {
    issues.push({ box: "Exclude", level: "stop", message: `Exclude is ${exclude.length} characters; Suno's box takes ${SUNO_LIMITS.exclude}.` });
  }
  if (!exclude) {
    issues.push({
      box: "Exclude",
      level: "tip",
      message: "Exclude styles is empty. A few common ones (muddy mix, buried vocals, fade-out) stop the usual Suno problems.",
      fix: "addExcludes",
    });
  }
  const excludeLeaks = findStyleLeaks(exclude, names);
  if (excludeLeaks.length) {
    issues.push({ box: "Exclude", level: "warn", message: `Artist names in Exclude (${excludeLeaks.join(", ")}). Describe the sound to avoid instead.` });
  }

  // Lyrics
  if (lyrics) {
    if (lyrics.length > SUNO_LIMITS.lyrics) {
      issues.push({
        box: "Lyrics",
        level: "stop",
        message: `Lyrics are ${lyrics.length.toLocaleString()} characters; Suno's box takes ${SUNO_LIMITS.lyrics.toLocaleString()}. Cut a verse or repeat the chorus by tag instead of in full.`,
      });
    }
    const lines = lyrics.split("\n").filter((l) => l.trim());
    const tags = lines.filter((l) => TAG_LINE.test(l));
    if (!tags.length && lines.length > 4) {
      issues.push({ box: "Lyrics", level: "warn", message: "No section tags. Add [Verse 1], [Chorus] and so on, so Suno knows the shape of the song." });
    }
    if (!hasCleanEnding(lyrics) && exportLyrics(lyrics, true).added) {
      issues.push({
        box: "Lyrics",
        level: "warn",
        message: "No clean ending. An [Instrumental Outro] and [End] help Suno sing every line and stop instead of trailing off.",
        fix: "cleanEnding",
      });
    }
    const leaks = findStyleLeaks(lyrics, names);
    if (leaks.length) {
      issues.push({ box: "Lyrics", level: "warn", message: `Artist names in the lyrics (${leaks.join(", ")}). Suno may refuse them; check they're meant to be sung.` });
    }
    const report = checkLyrics(lyrics);
    if (report.clicheCount) {
      issues.push({
        box: "Lyrics",
        level: report.clicheCount >= 3 ? "warn" : "tip",
        message: `${report.clicheCount} worn-out AI phrase${report.clicheCount === 1 ? "" : "s"} (neon lights, lost in the shadows…). The Lyric Checker shows which lines.`,
      });
    }
    if (report.pronunciationCount) {
      issues.push({
        box: "Lyrics",
        level: "tip",
        message: `${report.pronunciationCount} word${report.pronunciationCount === 1 ? "" : "s"} Suno often sings wrong. The Lyric Checker shows them with spellings that help.`,
      });
    }
  } else {
    issues.push({ box: "Lyrics", level: "tip", message: "No lyrics. Fine for an instrumental; otherwise Suno writes its own words." });
  }

  // Title
  if (title.length > SUNO_LIMITS.title) {
    issues.push({ box: "Title", level: "stop", message: `Title is ${title.length} characters; Suno takes ${SUNO_LIMITS.title}.` });
  }
  const titleLeaks = findStyleLeaks(title, names);
  if (titleLeaks.length) {
    issues.push({ box: "Title", level: "warn", message: `Artist name in the title (${titleLeaks.join(", ")}).` });
  }

  const order = { stop: 0, warn: 1, tip: 2 } as const;
  issues.sort((a, b) => order[a.level] - order[b.level]);
  const penalty = issues.reduce((n, i) => n + (i.level === "stop" ? 25 : i.level === "warn" ? 8 : 3), 0);
  const score = Math.max(0, 100 - penalty);
  return { score, verdict: verdictFor(score, issues), issues, counts };
}

export function verdictFor(score: number, issues: CheckerIssue[]): string {
  if (issues.some((i) => i.level === "stop")) return "Fix the red ones first";
  if (score >= 90) return "Ready for Suno";
  if (score >= 70) return "Nearly there";
  if (score >= 45) return "Needs work";
  return "Likely to misfire";
}

/** Applies one fix and returns the new boxes. Never touches a box the fix isn't about. */
export function applyFix(input: CheckerInput, fix: CheckerFix): CheckerInput {
  const names = namesFor(input);
  switch (fix) {
    case "removeNames": {
      return {
        ...input,
        style: scrubArtistNames(input.style, names).text,
        exclude: scrubArtistNames(input.exclude, names).text,
        title: scrubArtistNames(input.title, names).text,
      };
    }
    case "placeVocal":
      return { ...input, style: placeVocal(input.style) };
    case "cleanEnding":
      return { ...input, lyrics: exportLyrics(input.lyrics.trim(), true).text };
    case "addExcludes":
      return { ...input, exclude: mergeExcludes(input.exclude, COMMON_EXCLUDES, input.style) };
    case "moveNegatives": {
      const neg = negativeTags(input.style);
      if (!neg.length) return input;
      const keep = tagsOf(input.style).filter((t) => !neg.includes(t));
      const moved = neg.map((t) => t.replace(NEGATIVE_TAG, "$1").trim()).join(", ");
      return { ...input, style: keep.join(", "), exclude: mergeExcludes(input.exclude, moved, keep.join(", ")) };
    }
    case "removeFluff": {
      const fluff = fluffTags(input.style);
      return fluff.length ? { ...input, style: tagsOf(input.style).filter((t) => !fluff.includes(t)).join(", ") } : input;
    }
    case "trimStyle":
      return { ...input, style: fitToLimit(input.style.trim(), SUNO_LIMITS.style) };
  }
}

/** Pasted lyrics as Lyric Forge sections: [Tags] start sections; [End] markers are dropped (the Sheet adds its own). */
export function sectionsFromText(text: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (TAG_LINE.test(line)) {
      if (/^\[(end|hard stop)\]$/i.test(line)) continue;
      current = { tag: line, lines: [] };
      out.push(current);
      continue;
    }
    if (!current) {
      current = { tag: "[Verse 1]", lines: [] };
      out.push(current);
    }
    current.lines.push({ text: line, locked: false });
  }
  return out;
}

/** What the checker hands to the studio (kept in this tab's sessionStorage, read once). */
export const CHECKER_IMPORT_KEY = "bb.checker-import";
export type CheckerImport = { title: string; style: string; exclude: string; lyrics: string; at: number };

export function readCheckerImport(raw: string | null, now = Date.now()): CheckerImport | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CheckerImport>;
    if (typeof v.style !== "string" || typeof v.at !== "number" || now - v.at > 10 * 60 * 1000) return null;
    const s = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
    return {
      title: s(v.title, SUNO_LIMITS.title),
      style: s(v.style, 4000),
      exclude: s(v.exclude, 4000),
      lyrics: s(v.lyrics, 12000),
      at: v.at,
    };
  } catch {
    return null;
  }
}
