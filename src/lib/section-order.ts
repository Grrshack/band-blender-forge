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
  "[Drop]",
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
