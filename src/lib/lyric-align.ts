/**
 * "Did Suno sing my lyrics?" — lines up what speech recognition heard in a take with the
 * lyrics that were written, word by word, and reports skipped or changed lines with their
 * times. Also builds synced-lyrics (LRC) text from the matched times. Pure, so it's tested.
 *
 * Speech recognition is trained on speech, not singing, so a mismatch means "listen here",
 * not "this is definitely wrong". The UI says so.
 */

export type HeardWord = { text: string; start: number; end: number };

export type LyricLineInput = { section: string; text: string };

export type LineStatus = "ok" | "changed" | "missing";

export type LineResult = {
  section: string;
  text: string;
  status: LineStatus;
  /** What was heard across this line's span (empty when missing). */
  heard: string;
  /** Seconds; null when nothing in the line was matched. */
  start: number | null;
  end: number | null;
  /** Written words that weren't sung as written. */
  wrongWords: string[];
};

export type LyricCheck = {
  lines: LineResult[];
  /** Share of written words that were heard as written, 0–100. */
  accuracyPct: number;
  /** Lines worth a listen (changed or missing), in song order. */
  issues: LineResult[];
};

/** Words sung on top of the lyric that don't count: ad-libs in parentheses are optional. */
const stripOptional = (line: string) => line.replace(/\([^)]*\)/g, " ");

const NUMBERS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
  "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve",
  "20": "twenty", "100": "hundred",
};

/** Lower-case, no punctuation, digits as words, common spellings folded together. */
export function normWord(w: string): string {
  let x = w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9áéíóúñü]+/g, "");
  if (NUMBERS[x]) x = NUMBERS[x]!;
  // Spelling variants Whisper and writers disagree on.
  const fold: Record<string, string> = {
    gonna: "goingto", wanna: "wantto", gotta: "gotto", tryna: "tryingto",
    ok: "okay", til: "till", until: "till", cause: "because", cuz: "because",
    em: "them", ya: "you", yeah: "yeah", yea: "yeah", oh: "oh", ooh: "oh", whoa: "oh",
  };
  return fold[x] ?? x;
}

export function words(line: string): string[] {
  return stripOptional(line)
    .replace(/\b(a\.m\.|p\.m\.)/gi, (m) => m.replace(/\./g, ""))
    .split(/[\s\-–—/]+/)
    .map(normWord)
    .filter(Boolean);
}

/** Levenshtein distance between two short strings. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]!;
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i]!;
      dp[i] = Math.min(dp[i]! + 1, dp[i - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length]!;
}

/** Same word, or close enough that it's a spelling/recognition difference ("colour" / "color"). */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1);
}

type Step = { kind: "match" | "sub" | "del" | "ins"; e: number; h: number };

/** Word alignment (edit distance with traceback). Expected = written, heard = recognised. */
function align(expected: string[], heard: string[]): Step[] {
  const n = expected.length;
  const m = heard.length;
  const W = m + 1;
  const cost = new Float64Array((n + 1) * W);
  const back = new Uint8Array((n + 1) * W); // 0 diag, 1 up (del), 2 left (ins)
  for (let i = 1; i <= n; i++) {
    cost[i * W] = i;
    back[i * W] = 1;
  }
  for (let j = 1; j <= m; j++) {
    // Heard words before the lyric starts (count-ins, hallucinations) are free to skip.
    cost[j] = 0;
    back[j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = cost[(i - 1) * W + j - 1]! + (sameWord(expected[i - 1]!, heard[j - 1]!) ? 0 : 1);
      const up = cost[(i - 1) * W + j]! + 1;
      // Heard words after the last written word are free too (trailing "thank you" etc.).
      const left = cost[i * W + j - 1]! + (i === n ? 0 : 1);
      let best = diag;
      let dir = 0;
      if (up < best) {
        best = up;
        dir = 1;
      }
      if (left < best) {
        best = left;
        dir = 2;
      }
      cost[i * W + j] = best;
      back[i * W + j] = dir;
    }
  }
  const steps: Step[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = i === 0 ? 2 : j === 0 ? 1 : back[i * W + j]!;
    if (dir === 0) {
      steps.push({ kind: sameWord(expected[i - 1]!, heard[j - 1]!) ? "match" : "sub", e: i - 1, h: j - 1 });
      i--;
      j--;
    } else if (dir === 1) {
      steps.push({ kind: "del", e: i - 1, h: -1 });
      i--;
    } else {
      steps.push({ kind: "ins", e: -1, h: j - 1 });
      j--;
    }
  }
  return steps.reverse();
}

/** Recognisers mark music this way; invented sign-offs ("Thank you.") fall outside the lyric and cost nothing. */
const HALLUCINATIONS = /^\s*(\[[^\]]*\]|\([^)]*music[^)]*\)|♪+)\s*$/i;

export function checkLyrics(lyricLines: LyricLineInput[], heardRaw: HeardWord[]): LyricCheck {
  const heard = heardRaw
    .map((w) => ({ ...w, norm: normWord(w.text) }))
    .filter((w) => w.norm && !HALLUCINATIONS.test(w.text.trim()));

  const lines = lyricLines.filter((l) => l.text.trim());
  const expected: string[] = [];
  const lineOf: number[] = [];
  lines.forEach((l, li) => {
    for (const w of words(l.text)) {
      expected.push(w);
      lineOf.push(li);
    }
  });

  const steps = align(
    expected,
    heard.map((h) => h.norm),
  );

  type Acc = { matched: number; total: number; heardIdx: number[]; wrong: string[] };
  const acc: Acc[] = lines.map(() => ({ matched: 0, total: 0, heardIdx: [], wrong: [] }));
  const original = lines.map((l) => stripOptional(l.text).split(/[\s\-–—/]+/).filter((w) => normWord(w)));
  const wordPos = new Map<number, number>(); // expected index -> position within its line
  {
    const seen = lines.map(() => 0);
    lineOf.forEach((li, e) => wordPos.set(e, seen[li]!++));
  }
  let lastLine = 0;
  for (const s of steps) {
    if (s.e >= 0) {
      const li = lineOf[s.e]!;
      lastLine = li;
      acc[li]!.total++;
      if (s.kind === "match") acc[li]!.matched++;
      else acc[li]!.wrong.push(original[li]![wordPos.get(s.e)!] ?? expected[s.e]!);
      if (s.h >= 0) acc[li]!.heardIdx.push(s.h);
    } else if (s.h >= 0 && expected.length) {
      // An extra heard word belongs to the line being sung around it.
      acc[lastLine]!.heardIdx.push(s.h);
    }
  }

  const result: LineResult[] = lines.map((l, li) => {
    const a = acc[li]!;
    // Heard words inside the line's matched span, so the "heard" text reads naturally.
    const matchedHeard = steps
      .filter((s) => s.e >= 0 && lineOf[s.e] === li && s.h >= 0)
      .map((s) => s.h);
    const lo = matchedHeard.length ? Math.min(...matchedHeard) : -1;
    const hi = matchedHeard.length ? Math.max(...matchedHeard) : -1;
    const span = lo >= 0 ? heard.slice(lo, hi + 1) : [];
    const ratio = a.total ? a.matched / a.total : 1;
    const status: LineStatus = a.total === 0 ? "ok" : ratio < 0.34 ? "missing" : a.wrong.length ? "changed" : "ok";
    return {
      section: l.section,
      text: l.text,
      status,
      heard:
        status === "missing"
          ? ""
          : span
              .map((w) => w.text.trim())
              .join(" ")
              .replace(/\s+([,.!?])/g, "$1")
              .replace(/[,.;:]+$/, ""),
      start: status === "missing" || !span.length ? null : span[0]!.start,
      end: status === "missing" || !span.length ? null : span[span.length - 1]!.end,
      wrongWords: status === "ok" ? [] : a.wrong,
    };
  });

  const total = acc.reduce((s, a) => s + a.total, 0);
  const matched = acc.reduce((s, a) => s + a.matched, 0);
  return {
    lines: result,
    accuracyPct: total ? Math.round((matched / total) * 100) : 0,
    issues: result.filter((r) => r.status !== "ok"),
  };
}

/** Lyric sections (from Lyric Forge or pasted text) as lines, skipping [tags] and empty lines. */
export function linesFromText(text: string): LyricLineInput[] {
  let section = "";
  const out: LyricLineInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const tag = /^\[([^\]]+)\]$/.exec(line);
    if (tag) {
      // A bracketed cue right after a section tag ("[Whispered, sparse]") isn't a new section.
      if (/^(intro|verse|pre-?chorus|chorus|post-?chorus|bridge|outro|hook|refrain|break|drop|interlude)/i.test(tag[1]!)) {
        section = tag[1]!;
      }
      continue;
    }
    out.push({ section, text: line });
  }
  return out;
}

const two = (n: number) => String(n).padStart(2, "0");

/** LRC timestamp, e.g. 83.4 → "01:23.40". */
export function lrcTime(sec: number): string {
  const total = Math.round(Math.max(0, sec) * 100); // hundredths, rounded once
  const m = Math.floor(total / 6000);
  const s = Math.floor((total % 6000) / 100);
  const h = total % 100;
  return `${two(m)}:${two(s)}.${two(h)}`;
}

/**
 * Synced lyrics in LRC format: one "[mm:ss.xx]line" per sung line. Missing lines get a time
 * halfway between their neighbours, so the file stays complete; they're marked in the UI.
 */
export function buildLrc(lines: LineResult[], meta: { title?: string; artist?: string } = {}): string {
  const times: Array<number | null> = lines.map((l) => l.start);
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== null) continue;
    const prev = [...times.slice(0, i)].reverse().find((t) => t !== null) ?? null;
    const next = times.slice(i + 1).find((t) => t !== null) ?? null;
    times[i] = prev !== null && next !== null ? (prev + next) / 2 : prev !== null ? prev + 3 : next !== null ? Math.max(0, next - 3) : null;
  }
  const head = [meta.title ? `[ti:${meta.title}]` : "", meta.artist ? `[ar:${meta.artist}]` : "", "[by:Band Blender]"].filter(Boolean);
  const body = lines
    .map((l, i) => (times[i] === null ? "" : `[${lrcTime(times[i]!)}]${l.text.trim()}`))
    .filter(Boolean);
  return [...head, ...body].join("\n");
}

/** Plain-language instruction for Suno v6's single-lyric edit. */
export function sunoEditFor(line: LineResult, fmt: (s: number) => string): string {
  if (line.status === "missing") {
    return `This line wasn't heard: "${line.text.trim()}". Check whether Suno skipped it, then edit that part of the song or regenerate the section.`;
  }
  const at = line.start !== null && line.end !== null ? ` at ${fmt(line.start)}–${fmt(line.end)}` : "";
  return `In Suno, edit the lyric${at}: it sounds like "${line.heard}" but should be "${line.text.trim()}".`;
}
