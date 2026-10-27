/**
 * Promo clips: where the best 15 or 30 seconds of a song are (from the energy analysis), and
 * which synced lyric lines fall inside a clip. Pure, so it's tested.
 */
import { formatTime, type SongAnalysis } from "@/lib/audio/song-analysis";

export type ClipPick = { start: number; end: number; label: string; why: string };

/**
 * Candidate clips, best first. A clip starts one bar before a big section so the lift lands
 * inside it; with no big sections, the loudest stretch is used.
 */
export function clipCandidates(a: SongAnalysis, length: number): ClipPick[] {
  const dur = a.durationSec;
  if (dur <= length) return [{ start: 0, end: dur, label: "Whole song", why: "The song is shorter than the clip." }];
  const pre = a.bpm ? 240 / a.bpm : 1.5; // one bar of lead-in
  const at = (s: number) => {
    const start = Math.max(0, Math.min(dur - length, s - pre));
    return { start, end: start + length };
  };
  const highs = a.sections.filter((s) => s.energy === "high");
  const picks: ClipPick[] = [];
  highs.forEach((s, i) => {
    const label = i === 0 ? "First big lift" : i === highs.length - 1 && highs.length > 1 ? "Last big section" : `Big section ${i + 1}`;
    const why =
      i === 0
        ? `The first chorus or drop at ${formatTime(s.start)}: usually the hook, and what people should hear first.`
        : i === highs.length - 1
          ? `The final big section at ${formatTime(s.start)}: often the fullest version of the hook.`
          : `Another big section at ${formatTime(s.start)}.`;
    picks.push({ ...at(s.start), label, why });
  });
  if (!picks.length) {
    const mids = [...a.sections].filter((s) => s.energy === "mid").sort((x, y) => y.end - y.start - (x.end - x.start));
    const s = mids[0] ?? a.sections[0];
    if (s) picks.push({ ...at(s.start + pre), label: "Fullest part", why: "No clear big section, so this is the longest busy stretch." });
  }
  // Drop near-duplicates (starts within 5 s of a better pick).
  const out: ClipPick[] = [];
  for (const p of picks) if (!out.some((o) => Math.abs(o.start - p.start) < 5)) out.push(p);
  return out.slice(0, 4);
}

export type TimedLine = { time: number; text: string };

/** Reads "[mm:ss.xx]text" lines; ignores [ti:] style headers. */
export function parseLrc(lrc: string): TimedLine[] {
  const out: TimedLine[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const m = /^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(row.trim());
    if (m) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text: m[3]!.trim() });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** The line showing at `t` seconds (the last line that started at or before t). */
export function lineAt(lines: TimedLine[], t: number): string {
  let cur = "";
  for (const l of lines) {
    if (l.time <= t + 0.05) cur = l.text;
    else break;
  }
  return cur;
}

/** Lines inside a clip, with times relative to the clip start; the line playing at the start is included. */
export function linesInClip(lines: TimedLine[], start: number, end: number): TimedLine[] {
  const before = lines.filter((l) => l.time <= start);
  const inside = lines.filter((l) => l.time > start && l.time < end);
  const first = before[before.length - 1];
  return [...(first ? [{ time: 0, text: first.text }] : []), ...inside.map((l) => ({ time: l.time - start, text: l.text }))];
}
