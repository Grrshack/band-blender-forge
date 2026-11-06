import { describe, expect, it } from "vitest";
import { dropIndex, duplicateSection, insertSection, moveItem, newSection, numberedTag } from "./section-order";
import type { Section } from "@/components/forge/types";

const S = (tag: string, lines: string[] = []): Section => ({ tag, lines: lines.map((text) => ({ text, locked: false })) });
const tags = (xs: Section[]) => xs.map((s) => s.tag);

describe("section order", () => {
  const song = [S("[Intro]"), S("[Verse 1]", ["a"]), S("[Chorus]", ["b"]), S("[Verse 2]", ["c"]), S("[Outro]")];

  it("moves a section up, down and to the ends", () => {
    expect(tags(moveItem(song, 4, 2))).toEqual(["[Intro]", "[Verse 1]", "[Outro]", "[Chorus]", "[Verse 2]"]);
    expect(tags(moveItem(song, 0, 1))).toEqual(["[Verse 1]", "[Intro]", "[Chorus]", "[Verse 2]", "[Outro]"]);
    expect(moveItem(song, 0, -3)).toBe(song); // already first
    expect(tags(moveItem(song, 1, 99))).toEqual(["[Intro]", "[Chorus]", "[Verse 2]", "[Outro]", "[Verse 1]"]);
  });

  it("drops before or after the section under the pointer", () => {
    // Drag Outro (4) onto the top half of Chorus (2): lands at 2.
    expect(tags(moveItem(song, 4, dropIndex(4, 2, false)))[2]).toBe("[Outro]");
    // Drag Intro (0) onto the bottom half of Chorus (2): lands right after Chorus.
    expect(tags(moveItem(song, 0, dropIndex(0, 2, true)))).toEqual(["[Verse 1]", "[Chorus]", "[Intro]", "[Verse 2]", "[Outro]"]);
    // Dropping on itself changes nothing.
    expect(moveItem(song, 2, dropIndex(2, 2, false))).toBe(song);
    expect(moveItem(song, 2, dropIndex(2, 2, true))).toBe(song);
  });

  it("adds sections where asked, with numbered verses and lines to write", () => {
    const solo = newSection("[Guitar Solo]", song);
    expect(solo.lines).toEqual([]);
    expect(tags(insertSection(song, solo, 2))).toEqual(["[Intro]", "[Verse 1]", "[Chorus]", "[Guitar Solo]", "[Verse 2]", "[Outro]"]);
    expect(tags(insertSection(song, solo))).toEqual([...tags(song), "[Guitar Solo]"]);
    expect(tags(insertSection(song, solo, -1))[0]).toBe("[Guitar Solo]");
    const verse = newSection("[Verse]", song);
    expect(verse.tag).toBe("[Verse 3]");
    expect(verse.lines).toHaveLength(4);
    expect(numberedTag("Bridge", song)).toBe("[Bridge]");
  });

  it("duplicates a section right below it, unlocked", () => {
    const locked = [S("[Chorus]"), S("[Verse 1]")];
    locked[0] = { tag: "[Chorus]", cue: "Full", lines: [{ text: "hook", locked: true }] };
    const out = duplicateSection(locked, 0);
    expect(tags(out)).toEqual(["[Chorus]", "[Chorus]", "[Verse 1]"]);
    expect(out[1]).toEqual({ tag: "[Chorus]", cue: "Full", lines: [{ text: "hook", locked: false }] });
  });
});
