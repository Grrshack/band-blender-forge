import { describe, expect, it } from "vitest";
import { checkLyrics } from "@/lib/lyric-check";
import { METATAG_GROUPS } from "@/lib/metatags";
import { RELEASE_CHECKLIST } from "@/lib/release-checklist";

describe("lyric checker", () => {
  const text = `[Verse 1]
Neon lights in the city tonight
Grey rain on the window
Coffee going cold
I count every single car that drives away and never ever ever comes back home again tonight

[Chorus]
Meet me at 3am
Hold on, hold on`;
  const r = checkLyrics(text);

  it("separates tags from sung lines", () => {
    expect(r.lines.filter((l) => l.isTag).map((l) => l.text)).toEqual(["[Verse 1]", "[Chorus]"]);
    expect(r.sungLines).toBe(6);
  });

  it("flags clichés, numbers and an over-long line", () => {
    expect(r.lines[1]!.cliches).toContain("neon lights");
    expect(r.lines.find((l) => l.text.includes("3am"))!.pronunciation[0]!.suggestion).toMatch(/three A\.M\./);
    expect(r.lines[4]!.lengthOutlier).toBe(true);
    expect(r.clicheCount).toBeGreaterThan(0);
  });

  it("handles empty input", () => {
    expect(checkLyrics("").sungLines).toBe(0);
  });
});

describe("reference data", () => {
  it("metatags are bracketed and unique", () => {
    const all = METATAG_GROUPS.flatMap((g) => g.tags.map((t) => t.tag));
    expect(new Set(all).size).toBe(all.length);
    for (const t of all) expect(t).toMatch(/^[[(].+[\])]$/);
  });
  it("release checklist links go to Suno's help site", () => {
    for (const item of RELEASE_CHECKLIST)
      for (const [, href] of item.links ?? []) expect(href).toMatch(/^https:\/\/help\.suno\.com\//);
  });
});
