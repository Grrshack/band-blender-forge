import { describe, expect, it } from "vitest";
import { prompt } from "@/lib/forge-prompts";

describe("song prompt with measurements", () => {
  it("tells the model to trust measured tempo and to rely on the description", () => {
    const p = prompt("song", {
      title: "",
      artist: "",
      description: "moody trip-hop, breathy vocal",
      measured: { bpm: 84, key: "A minor (confidence high)" },
    });
    expect(p).toMatch(/measured BPM as ground truth/);
    expect(p).toMatch(/listener's own words/);
    expect(p).toMatch(/no song title/);
  });

  it("is unchanged for a plain named-song lookup", () => {
    const p = prompt("song", { title: "Teardrop", artist: "Massive Attack" });
    expect(p).not.toMatch(/measured/);
    expect(p).not.toMatch(/no song title/);
  });
});

describe("reimagine", () => {
  it("rewrites around the new genre and returns exclusions", () => {
    const p = prompt("refine", { styleTag: "trip-hop, 84 bpm", excludeStyles: "edm", reimagine: "Jazz", sunoVersion: "v6" });
    expect(p).toMatch(/Reimagine this song's Suno style as Jazz/);
    expect(p).toMatch(/"excludeStyles"/);
  });
  it("plain refine keeps the small-edit rules", () => {
    expect(prompt("refine", { styleTag: "x", instruction: "darker" })).toMatch(/at most 4 tag elements/);
  });
});
