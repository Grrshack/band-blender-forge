/**
 * Song-length planner: turns a target length + tempo + template into sections with
 * bar counts and lyric-line counts. It STEERS generation; the generator decides the
 * final length, so treat the result as a plan, not a guarantee.
 */

export type PlanTemplate = "pop" | "ballad" | "rock" | "hiphop" | "electronic";

type Slot = { tag: string; weight: number; instrumental?: boolean };

const TEMPLATES: Record<PlanTemplate, { label: string; linesPerBar: number; slots: Slot[] }> = {
  pop: {
    label: "Pop",
    linesPerBar: 0.5,
    slots: [
      { tag: "[Intro]", weight: 1, instrumental: true },
      { tag: "[Verse 1]", weight: 4 },
      { tag: "[Pre-Chorus]", weight: 2 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Verse 2]", weight: 4 },
      { tag: "[Pre-Chorus]", weight: 2 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Bridge]", weight: 2 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Outro]", weight: 1, instrumental: true },
    ],
  },
  ballad: {
    label: "Ballad",
    linesPerBar: 0.5,
    slots: [
      { tag: "[Intro]", weight: 1, instrumental: true },
      { tag: "[Verse 1]", weight: 4 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Verse 2]", weight: 4 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Bridge]", weight: 3 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Outro]", weight: 1, instrumental: true },
    ],
  },
  rock: {
    label: "Rock",
    linesPerBar: 0.5,
    slots: [
      { tag: "[Intro]", weight: 1, instrumental: true },
      { tag: "[Verse 1]", weight: 4 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Verse 2]", weight: 4 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Guitar Solo]", weight: 2, instrumental: true },
      { tag: "[Bridge]", weight: 2 },
      { tag: "[Chorus]", weight: 4 },
      { tag: "[Outro]", weight: 1, instrumental: true },
    ],
  },
  hiphop: {
    label: "Hip-hop",
    linesPerBar: 1,
    slots: [
      { tag: "[Intro]", weight: 1, instrumental: true },
      { tag: "[Verse 1]", weight: 8 },
      { tag: "[Hook]", weight: 4 },
      { tag: "[Verse 2]", weight: 8 },
      { tag: "[Hook]", weight: 4 },
      { tag: "[Verse 3]", weight: 6 },
      { tag: "[Hook]", weight: 4 },
      { tag: "[Outro]", weight: 1, instrumental: true },
    ],
  },
  electronic: {
    label: "Electronic",
    linesPerBar: 0.25,
    slots: [
      { tag: "[Intro]", weight: 4, instrumental: true },
      { tag: "[Verse 1]", weight: 3 },
      { tag: "[Build-Up]", weight: 2, instrumental: true },
      { tag: "[Drop]", weight: 4, instrumental: true },
      { tag: "[Verse 2]", weight: 3 },
      { tag: "[Build-Up]", weight: 2, instrumental: true },
      { tag: "[Drop]", weight: 4, instrumental: true },
      { tag: "[Outro]", weight: 3, instrumental: true },
    ],
  },
};

export const PLAN_TEMPLATES = (Object.keys(TEMPLATES) as PlanTemplate[]).map((key) => ({
  key,
  label: TEMPLATES[key].label,
}));

export type PlanSection = {
  tag: string;
  bars: number;
  lines: number;
  seconds: number;
  instrumental: boolean;
};

export type SongPlan = {
  sections: PlanSection[];
  totalBars: number;
  totalSeconds: number;
  barSeconds: number;
  /** Plain-text plan for the lyric prompt. */
  text: string;
};

const GRID = 4; // sections are whole phrases of 4 bars

export function planSong(input: {
  seconds: number;
  bpm: number;
  template: PlanTemplate;
  beatsPerBar?: number;
}): SongPlan {
  const seconds = Math.min(600, Math.max(30, input.seconds));
  const bpm = Math.min(220, Math.max(50, input.bpm));
  const beats = input.beatsPerBar ?? 4;
  const t = TEMPLATES[input.template];

  const barSeconds = (beats * 60) / bpm;
  const targetBars = seconds / barSeconds;
  const weightSum = t.slots.reduce((n, s) => n + s.weight, 0);

  // Proportional share, rounded to whole 4-bar phrases (minimum one phrase each).
  const bars = t.slots.map((s) =>
    Math.max(GRID, Math.round(((s.weight / weightSum) * targetBars) / GRID) * GRID),
  );

  // Rounding drifts; nudge the biggest sections by one phrase until we are as close as the grid allows.
  const order = t.slots.map((_, i) => i).sort((a, b) => t.slots[b]!.weight - t.slots[a]!.weight);
  for (let guard = 0; guard < 200; guard++) {
    const sum = bars.reduce((n, b) => n + b, 0);
    const diff = targetBars - sum;
    if (Math.abs(diff) <= GRID / 2) break;
    const dir = diff > 0 ? 1 : -1;
    const pick = order.find((i) => dir > 0 || bars[i]! > GRID);
    if (pick === undefined) break;
    bars[pick] = bars[pick]! + dir * GRID;
  }

  const sections: PlanSection[] = t.slots.map((s, i) => {
    const b = bars[i]!;
    return {
      tag: s.tag,
      bars: b,
      lines: s.instrumental ? 0 : Math.max(2, Math.round(b * t.linesPerBar)),
      seconds: b * barSeconds,
      instrumental: Boolean(s.instrumental),
    };
  });

  const totalBars = sections.reduce((n, s) => n + s.bars, 0);
  const text = sections
    .map((s) =>
      s.instrumental
        ? `${s.tag} instrumental, ${s.bars} bars, no lyric lines`
        : `${s.tag} ${s.lines} lines (${s.bars} bars)`,
    )
    .join("; ");

  return { sections, totalBars, totalSeconds: totalBars * barSeconds, barSeconds, text };
}
