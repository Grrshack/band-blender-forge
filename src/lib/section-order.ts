/**
 * Moving and adding Lyric Forge sections: drag and drop, the up/down arrows, "Add where",
 * and duplicating a section. Pure, so it's tested.
 */
import type { Section } from "@/components/forge/types";

/** Moves the item at `from` so it ends up at index `to` in the result. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}

/**
 * Where a dragged item lands when dropped on `over`, in its top half (before) or bottom half
 * (after). Returns the final index, accounting for the item leaving its old place.
 */
export function dropIndex(from: number, over: number, after: boolean): number {
  const slot = over + (after ? 1 : 0);
  return slot > from ? slot - 1 : slot;
}

/** Sections that are sung get empty lines to write into; the rest are instrumental. */
export const LYRIC_SECTION_TAGS = ["[Verse]", "[Pre-Chorus]", "[Chorus]", "[Bridge]", "[Hook]", "[Post-Chorus]"];
export const INSTRUMENTAL_SECTION_TAGS = [
  "[Intro]",
  "[Guitar Solo]",
  "[Instrumental Break]",
  "[Build]",
  "[Drop]",
  "[Beat Switch]",
  "[Breakdown]",
  "[Outro]",
];

const base = (tag: string) => tag.replace(/[[\]]/g, "").replace(/\s+\d+$/, "").trim().toLowerCase();

/** "[Verse]" becomes "[Verse 3]" when there are already two verses; other tags stay as they are. */
export function numberedTag(tag: string, sections: Section[]): string {
  const clean = `[${tag.replace(/[[\]]/g, "").trim()}]`;
  if (base(clean) !== "verse") return clean;
  const count = sections.filter((s) => base(s.tag) === "verse").length;
  return `[Verse ${count + 1}]`;
}

/** A new section: sung ones come with four empty lines to write or generate. */
export function newSection(tag: string, sections: Section[], lines = 4): Section {
  const t = numberedTag(tag, sections);
  const sung = LYRIC_SECTION_TAGS.some((x) => base(x) === base(t));
  return { tag: t, lines: sung ? Array.from({ length: lines }, () => ({ text: "", locked: false })) : [] };
}

/** Inserts `section` right after index `after` (-1 = at the start, undefined = at the end). */
export function insertSection(sections: Section[], section: Section, after?: number): Section[] {
  const at = after === undefined ? sections.length : Math.max(0, Math.min(sections.length, after + 1));
  return [...sections.slice(0, at), section, ...sections.slice(at)];
}

/** A copy of a section placed right below it (for a repeated chorus). Lines come unlocked. */
export function duplicateSection(sections: Section[], index: number): Section[] {
  const s = sections[index];
  if (!s) return sections;
  const copy: Section = { tag: s.tag, ...(s.cue ? { cue: s.cue } : {}), lines: s.lines.map((l) => ({ text: l.text, locked: false })) };
  return insertSection(sections, copy, index);
}

/* ------------------------------------------------------------------ */
/* Song shifts: drops, key changes and beat switches live in the lyrics box as tags.            */
/* ------------------------------------------------------------------ */

const isChorus = (s: Section) => /chorus/.test(base(s.tag)) && !/pre-?chorus|post-?chorus/.test(base(s.tag));
const lastIndex = <T>(list: T[], test: (x: T) => boolean) => {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i]!)) return i;
  return -1;
};
const withCue = (s: Section, add: string): Section => {
  const have = (s.cue ?? "").split(/[,|;]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (have.includes(add.toLowerCase())) return s;
  return { ...s, cue: [s.cue?.trim(), add].filter(Boolean).join(", ") };
};

export type ShiftResult = { sections: Section[]; note: string };

/** [Build] and [Drop] (instrumental) right before the last chorus. */
export function addBuildAndDrop(sections: Section[]): ShiftResult {
  const at = lastIndex(sections, isChorus);
  if (at < 0) return { sections, note: "There's no chorus to build into yet." };
  if (base(sections[at - 1]?.tag ?? "") === "drop") return { sections, note: "There's already a drop before the last chorus." };
  const added: Section[] = [
    ...(base(sections[at - 1]?.tag ?? "") === "build" ? [] : [{ tag: "[Build]", lines: [] }]),
    { tag: "[Drop]", lines: [] },
  ];
  return { sections: [...sections.slice(0, at), ...added, ...sections.slice(at)], note: "Added a build and a drop before the last chorus." };
}

/** "Key change" (and stacked harmonies) on the last chorus. */
export function keyChangeLastChorus(sections: Section[]): ShiftResult {
  const at = lastIndex(sections, isChorus);
  if (at < 0) return { sections, note: "There's no chorus to lift yet." };
  const next = sections.map((s, i) => (i === at ? withCue(withCue(s, "Key change"), "Stacked harmonies") : s));
  return { sections: next, note: "The last chorus now has a key change and stacked harmonies." };
}

/** [Beat Switch] (instrumental) before the second verse, or before the bridge if there isn't one. */
export function beatSwitch(sections: Section[]): ShiftResult {
  const verses = sections.map((s, i) => (base(s.tag) === "verse" ? i : -1)).filter((i) => i >= 0);
  const at = verses[1] ?? sections.findIndex((s) => base(s.tag) === "bridge");
  if (at === undefined || at < 0) return { sections, note: "Add a second verse or a bridge first; the switch goes before it." };
  if (base(sections[at - 1]?.tag ?? "") === "beat switch") return { sections, note: "There's already a beat switch there." };
  return {
    sections: [...sections.slice(0, at), { tag: "[Beat Switch]", lines: [] }, ...sections.slice(at)],
    note: `Added a beat switch before ${sections[at]!.tag.replace(/[[\]]/g, "")}.`,
  };
}

/** How many times the singer changes between sung sections that name one. */
export function singerSwitches(sections: Section[]): number {
  const seq = sections.filter((s) => s.singer && s.lines.length).map((s) => s.singer);
  return seq.reduce((n, s, i) => (i > 0 && s !== seq[i - 1] ? n + 1 : n), 0);
}

/** True when the sections call for two voices (male and female, or a duet section). */
export function hasTwoSingers(sections: Section[]): boolean {
  const set = new Set(sections.map((s) => s.singer).filter(Boolean));
  return set.has("both") || (set.has("male") && set.has("female"));
}
