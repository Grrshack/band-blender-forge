import { describe, expect, it } from "vitest";

import { COVER_LOOKS, coverCrop, coverPrompt, lintCoverText } from "@/lib/cover";

describe("cover text check", () => {
  it("passes a plain title and artist", () => {
    expect(lintCoverText(["Night Shift", "Joe Grushack"])).toEqual([]);
  });
  it("flags links, handles, promo words and platform names", () => {
    const issues = lintCoverText(["Night Shift - out now on Spotify", "@joe www.joe.com"]);
    expect(issues).toHaveLength(4);
    expect(issues.join(" ")).toMatch(/web address/);
    expect(issues.join(" ")).toMatch(/handle/);
    expect(issues.join(" ")).toMatch(/spotify/);
  });
});

describe("cover prompts", () => {
  it("builds a natural-looking prompt from the song", () => {
    const p = coverPrompt(COVER_LOOKS[0]!, { theme: "A night-shift nurse driving home at 6am.", mood: "bittersweet" });
    expect(p).toMatch(/35mm film/);
    expect(p).toMatch(/Subject: A night-shift nurse driving home at 6am\./);
    expect(p).toMatch(/No text in the image/);
    expect(p).toMatch(/Avoid: glossy 3D render/);
  });
  it("has no prompt for the type-only look", () => {
    expect(coverPrompt(COVER_LOOKS.find((l) => l.id === "type")!, {})).toBe("");
  });
});

describe("cover crop", () => {
  it("takes the centered square of a landscape image", () => {
    expect(coverCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });
  it("zooms and moves within the image", () => {
    const c = coverCrop(4000, 3000, 2, 1, -1);
    expect(c.size).toBe(1500);
    expect(c.sx).toBe(2500); // right edge
    expect(c.sy).toBe(0); // top edge
  });
});
