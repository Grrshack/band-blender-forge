import { describe, expect, it } from "vitest";

import { KNOWN_ARTISTS, applyFix, checkPrompt, readCheckerImport, sectionsFromText, type CheckerInput } from "./prompt-checker";

const base: CheckerInput = {
  title: "Night Shift",
  style: "dream pop, 90 BPM, shimmering synths, close-miked breathy female vocal upfront",
  exclude: "muddy mix, fade-out",
  lyrics: "[Verse 1]\nHeadlights on the overpass\nCounting every exit sign\n\n[Chorus]\nNight shift\n\n[Instrumental Outro]\n[End]",
  artists: [],
  version: "v6",
};

const fixesOf = (i: CheckerInput) => checkPrompt(i).issues.map((x) => x.fix).filter(Boolean);

describe("checkPrompt", () => {
  it("scores a clean prompt as ready", () => {
    const r = checkPrompt(base);
    expect(r.issues.filter((i) => i.level !== "tip")).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.verdict).toBe("Ready for Suno");
  });

  it("waits for a style before scoring", () => {
    const r = checkPrompt({ ...base, style: "  " });
    expect(r.score).toBeNull();
    expect(r.issues).toEqual([]);
  });

  it("catches well-known names without being told, and 'in the style of' any name", () => {
    expect(KNOWN_ARTISTS).toContain("Radiohead");
    const r = checkPrompt({ ...base, style: `${base.style}, like Radiohead` });
    expect(r.issues.some((i) => i.level === "stop" && /Radiohead/.test(i.message) && i.fix === "removeNames")).toBe(true);
    expect(r.verdict).toBe("Fix the red ones first");
    const g = checkPrompt({ ...base, style: `${base.style}, in the style of Zed Quillfeather` });
    expect(g.issues.some((i) => /Zed Quillfeather/.test(i.message))).toBe(true);
  });

  it("removes names, praise words and negatives with one click each", () => {
    let i: CheckerInput = { ...base, style: "dream pop, Radiohead, high quality, amazing, no autotune, 90 BPM, female vocal upfront" };
    expect(fixesOf(i)).toEqual(expect.arrayContaining(["removeNames", "removeFluff", "moveNegatives"]));
    i = applyFix(i, "removeNames");
    expect(i.style).not.toMatch(/Radiohead/);
    i = applyFix(i, "removeFluff");
    expect(i.style).not.toMatch(/high quality|amazing/);
    i = applyFix(i, "moveNegatives");
    expect(i.style).not.toMatch(/no autotune/);
    expect(i.exclude).toMatch(/autotune/);
    expect(checkPrompt(i).issues.filter((x) => x.level !== "tip")).toEqual([]);
  });

  it("adds a clean ending and common excludes", () => {
    const i = { ...base, exclude: "", lyrics: "[Verse 1]\nOne line\nTwo line" };
    expect(fixesOf(i)).toEqual(expect.arrayContaining(["cleanEnding", "addExcludes"]));
    const fixed = applyFix(applyFix(i, "cleanEnding"), "addExcludes");
    expect(fixed.lyrics.endsWith("[Instrumental Outro]\n[End]")).toBe(true);
    expect(fixed.exclude).toMatch(/muddy mix/);
    expect(fixesOf(fixed)).not.toContain("cleanEnding");
  });

  it("flags limits, trims the style, and notices missing tags, tempo and vocal", () => {
    const long = Array.from({ length: 120 }, (_, n) => `texture ${n}`).join(", ");
    const r = checkPrompt({ ...base, style: long, lyrics: "line one\nline two\nline three\nline four\nline five" });
    expect(r.issues.some((i) => i.fix === "trimStyle" && i.level === "stop")).toBe(true);
    expect(r.issues.some((i) => /No section tags/.test(i.message))).toBe(true);
    expect(r.issues.some((i) => /No tempo/.test(i.message))).toBe(true);
    expect(r.issues.some((i) => /No vocal/.test(i.message))).toBe(true);
    expect(applyFix({ ...base, style: long }, "trimStyle").style.length).toBeLessThanOrEqual(1000);
  });

  it("puts stops first and lowers the score for each problem", () => {
    const r = checkPrompt({ ...base, title: "x".repeat(120), exclude: "" });
    expect(r.issues[0]!.level).toBe("stop");
    expect(r.score!).toBeLessThan(80);
  });
});

describe("sectionsFromText", () => {
  it("splits on tags, keeps untagged openers, drops [End]", () => {
    const s = sectionsFromText("first line\n[Chorus]\nhook\n\n[Instrumental Outro]\n[End]");
    expect(s.map((x) => x.tag)).toEqual(["[Verse 1]", "[Chorus]", "[Instrumental Outro]"]);
    expect(s[0]!.lines[0]!.text).toBe("first line");
    expect(s[2]!.lines).toEqual([]);
  });
});

describe("readCheckerImport", () => {
  it("reads a fresh import and ignores old or broken ones", () => {
    const now = 1_000_000;
    const ok = JSON.stringify({ title: "T", style: "pop", exclude: "", lyrics: "", at: now - 1000 });
    expect(readCheckerImport(ok, now)?.style).toBe("pop");
    expect(readCheckerImport(JSON.stringify({ style: "pop", at: now - 11 * 60 * 1000 }), now)).toBeNull();
    expect(readCheckerImport("{oops", now)).toBeNull();
    expect(readCheckerImport(null, now)).toBeNull();
  });
});
