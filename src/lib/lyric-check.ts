/**
 * Checks pasted lyrics without any AI: worn-out phrases, words Suno tends to sing wrong,
 * lines much longer or shorter than the rest of their section, and overused words.
 * Used by the free /tools/lyric-checker page. Pure, so it's unit tested.
 */
import { countSyllables, countWatchWordOccurrences, findCliches, isSyllableOutlier } from "./cliches";
import { findPronunciationRisks, type PronunciationRisk } from "./pronunciation";

export type LineCheck = {
  text: string;
  /** A [Section] tag line rather than a sung line. */
  isTag: boolean;
  syllables: number;
  cliches: string[];
  pronunciation: PronunciationRisk[];
  /** Far longer or shorter than the other lines in its section. */
  lengthOutlier: boolean;
};

export type LyricReport = {
  lines: LineCheck[];
  sungLines: number;
  clicheCount: number;
  pronunciationCount: number;
  outlierCount: number;
  overused: Array<{ word: string; count: number }>;
};

const isTagLine = (l: string) => /^\s*\[[^\]]+\]\s*$/.test(l);

export function checkLyrics(text: string): LyricReport {
  const raw = text.replace(/\r/g, "").split("\n");
  const lines: LineCheck[] = raw.map((t) => {
    const tag = isTagLine(t);
    const sung = !tag && t.trim() !== "";
    return {
      text: t,
      isTag: tag,
      syllables: sung ? countSyllables(t) : 0,
      cliches: sung ? findCliches(t) : [],
      pronunciation: sung ? findPronunciationRisks(t) : [],
      lengthOutlier: false,
    };
  });

  // Sections are split by [tags] and blank lines; each line is compared with its own section.
  let group: number[] = [];
  const flush = () => {
    const counts = group.map((i) => lines[i]!.syllables);
    group.forEach((i, k) => (lines[i]!.lengthOutlier = isSyllableOutlier(counts, k)));
    group = [];
  };
  lines.forEach((l, i) => {
    if (l.isTag || l.text.trim() === "") flush();
    else group.push(i);
  });
  flush();

  const sung = lines.filter((l) => !l.isTag && l.text.trim() !== "");
  const counts = countWatchWordOccurrences(sung.map((l) => l.text));
  return {
    lines,
    sungLines: sung.length,
    clicheCount: sung.reduce((n, l) => n + l.cliches.length, 0),
    pronunciationCount: sung.reduce((n, l) => n + l.pronunciation.length, 0),
    outlierCount: sung.filter((l) => l.lengthOutlier).length,
    overused: Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count),
  };
}
