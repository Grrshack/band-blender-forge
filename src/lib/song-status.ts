/**
 * Where a song is on the way from idea to release, and the one thing to do next.
 * Pure, so the song page, the progress strip and tests all agree.
 */
import type { ForgeState } from "@/components/forge/types";
import type { Take } from "@/lib/takes";

export type StepId = "sound" | "lyrics" | "takes" | "keeper" | "lyriccheck" | "master" | "cover" | "releasecheck";

export type Step = {
  id: StepId;
  label: string;
  done: boolean;
  /** Short status shown under the step, e.g. "92% sung as written". */
  detail: string;
  /** The studio tab that does this step. */
  tab: string;
  /** What the Next step button says when this is the next step. */
  action: string;
  /** Optional steps don't block "ready". */
  optional?: boolean;
};

const keeperOf = (takes: Take[]): Take | null => {
  let best: Take | null = null;
  for (const t of takes) if (t.rating >= 5 && (!best || t.at >= best.at)) best = t;
  return best;
};

/** The most recent lyric check on the keeper, or on any take if there's no keeper yet. */
export function latestLyricCheck(takes: Take[]) {
  const keeper = keeperOf(takes);
  const pool = keeper?.checks?.lyric ? [keeper] : takes.filter((t) => t.checks?.lyric);
  return pool.map((t) => t.checks!.lyric!).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

export function disclosureDone(state: ForgeState): boolean {
  const d = state.release?.disclosure;
  return Boolean(d?.lyrics && d.music && d.vocals && d.artwork);
}

export function songSteps(state: ForgeState): Step[] {
  const takes = state.takes;
  const keeper = keeperOf(takes);
  const lyric = latestLyricCheck(takes);
  const hasLyrics = state.lyrics.sections.some((s) => s.lines.length > 0);
  const instrumental = !hasLyrics && state.lyrics.tagsOnly;
  return [
    {
      id: "sound",
      label: "Sound",
      done: Boolean(state.blend.result?.styleTag?.trim()),
      detail: state.blend.result?.genre ?? "",
      tab: "blend",
      action: "Build the sound in Band Blender",
    },
    {
      id: "lyrics",
      label: "Lyrics",
      done: hasLyrics,
      detail: hasLyrics ? state.lyrics.title || "Written" : "",
      tab: "lyrics",
      action: "Write the lyrics in Lyric Forge",
      optional: instrumental,
    },
    {
      id: "takes",
      label: takes.length ? `Takes (${takes.length})` : "Takes",
      done: takes.length > 0,
      detail: takes.length ? `${takes.length} logged` : "",
      tab: "suno",
      action: "Generate in Suno, then log each take",
    },
    {
      id: "keeper",
      label: "Keeper",
      done: Boolean(keeper),
      detail: keeper ? "Picked" : "",
      tab: "fix",
      action: "Rate your takes and pick a keeper",
    },
    {
      id: "lyriccheck",
      label: "Lyric check",
      done: Boolean(lyric),
      detail: lyric ? `${lyric.accuracyPct}% sung as written` : "",
      tab: "lyriccheck",
      action: "Check that Suno sang your lyrics",
      optional: !hasLyrics,
    },
    {
      id: "master",
      label: "Mastered",
      done: Boolean(state.release?.masteredAt),
      detail: state.release?.masteredAt ? "Exported" : "",
      tab: "master",
      action: "Master the keeper",
    },
    {
      id: "cover",
      label: "Cover",
      done: Boolean(state.release?.cover),
      detail: state.release?.cover ? `${state.release.cover.size}×${state.release.cover.size}` : "",
      tab: "cover",
      action: "Make the cover",
    },
    {
      id: "releasecheck",
      label: "Release check",
      done: disclosureDone(state),
      detail: disclosureDone(state) ? "AI questions answered" : "",
      tab: "releasecheck",
      action: "Run the release check",
    },
  ];
}

export function nextStep(steps: Step[]): Step | null {
  return steps.find((s) => !s.done && !s.optional) ?? null;
}

/** 0–100, counting only the steps that apply to this song. */
export function readinessPct(steps: Step[]): number {
  const counted = steps.filter((s) => !s.optional || s.done);
  return counted.length ? Math.round((counted.filter((s) => s.done).length / counted.length) * 100) : 0;
}
