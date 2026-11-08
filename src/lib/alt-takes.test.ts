import { describe, expect, it } from "vitest";
import {
  activeTakeLabel,
  allTakes,
  directionsFor,
  removeTake,
  switchTake,
  takeFromAlternate,
  withAlternates,
  type RawAlternate,
} from "./alt-takes";
import { cleanAlternates, runPipeline } from "./forge-pipeline";
import { fakeAsk } from "./fake-ai";
import { briefMatches } from "./prompt-craft";
import { songPackFiles } from "./song-pack";
import { emptyState, type BlendResult } from "@/components/forge/types";

const main: BlendResult = { styleTag: "dark synthpop, 92 bpm", styleFormat: "tags", excludeStyles: "autotune", genre: "Synthpop" };

async function alternates(dirs = directionsFor(["darker", "drop"], "")) {
  const payload = { style: main.styleTag, directions: dirs, artists: ["Robyn"] };
  const out = (await runPipeline("alternates", payload, { ask: fakeAsk("alternates", payload), lookup: async () => [] })) as {
    alternates: RawAlternate[];
  };
  return out.alternates.map((a, i) => takeFromAlternate(a, "brief", i + 2)!);
}

describe("alternate takes", () => {
  it("picks directions, with your own, up to three", () => {
    expect(directionsFor(["darker", "drop"], "").map((d) => d.label)).toEqual(["Darker", "Bigger drop"]);
    expect(directionsFor(["darker", "drop", "softer"], "more 80s").map((d) => d.label)).toEqual(["Darker", "Bigger drop", "Softer"]);
    expect(directionsFor(["darker"], "more 80s").map((d) => d.label)).toEqual(["Darker", "More 80s"]);
  });

  it("makes each take in both formats, the Studio Brief first", async () => {
    const takes = await alternates();
    expect(takes.map((t) => t.label)).toEqual(["Darker", "Bigger drop"]);
    for (const t of takes) {
      expect(t.styleFormat).toBe("brief");
      expect(briefMatches(t.briefParts, t.styleTag)).toBe(true);
      expect(t.styleAlt).toMatch(/^dark synthpop,/);
      expect(t.excludeStyles).toBe("autotune, trap hi-hats");
    }
  });

  it("shows takes as tabs without losing edits, and removes them", async () => {
    let r = withAlternates(main, await alternates());
    expect(r.altTakes!.map((t) => t.label)).toEqual(["Main", "Darker", "Bigger drop"]);
    expect(r.styleTag).toBe(main.styleTag); // Main stays open

    const darker = r.altTakes![1]!;
    r = switchTake(r, darker.id);
    expect(r.styleTag).toBe(darker.styleTag);
    expect(activeTakeLabel(r)).toBe("Darker");

    r = { ...r, styleTag: `${r.styleTag} Edited.` }; // an edit on the Darker take
    r = switchTake(r, "main");
    expect(r.styleTag).toBe(main.styleTag);
    expect(r.excludeStyles).toBe("autotune");
    r = switchTake(r, darker.id);
    expect(r.styleTag).toMatch(/Edited\.$/); // kept

    const { takes, active } = allTakes(r);
    expect(takes).toHaveLength(3);
    expect(takes[active]!.label).toBe("Darker");

    r = removeTake(r, darker.id); // removing the open one goes back to Main
    expect(r.activeTake).toBe("main");
    expect(r.styleTag).toBe(main.styleTag);
    r = removeTake(r, r.altTakes!.find((t) => t.label === "Bigger drop")!.id);
    expect(r.altTakes).toBeUndefined(); // only Main left: no tabs
    expect(removeTake(main, "main")).toBe(main);
  });

  it("replaces a take of the same name when made again", async () => {
    const r1 = withAlternates(main, await alternates(directionsFor(["darker"], "")));
    const r2 = withAlternates(r1, await alternates(directionsFor(["darker"], "")));
    expect(r2.altTakes!.filter((t) => t.label === "Darker")).toHaveLength(1);
  });

  it("keeps takes safe: limits, fitting briefs, no artist names", () => {
    const long = "word ".repeat(400);
    const out = cleanAlternates(
      {
        alternates: [
          { label: "Darker", styleTag: `like Robyn, ${long}`, styleBriefParts: { sound: "Dark pop like Robyn.", pulse: long, players: "Synths.", voice: "Alto.", arc: "Builds.", finish: "Glossy." }, excludeStyles: "x" },
          { label: "Empty" },
          { label: "Extra", styleTag: "a" },
          { label: "Too many", styleTag: "b" },
        ],
      },
      ["Robyn"],
      3,
    ) as { alternates: Array<{ label: string; styleTag: string; styleBrief?: string }> };
    expect(out.alternates.map((a) => a.label)).toEqual(["Darker", "Extra"]);
    const d = out.alternates[0]!;
    expect(d.styleTag.length).toBeLessThanOrEqual(1000);
    expect(d.styleTag).not.toMatch(/robyn/i);
    expect(d.styleBrief!.length).toBeLessThanOrEqual(1000);
    expect(d.styleBrief).not.toMatch(/robyn/i);
  });

  it("puts the other takes in the song pack", async () => {
    const s = emptyState();
    s.lyrics.title = "Neon";
    s.blend.result = withAlternates(main, await alternates());
    const files = new Map(songPackFiles("Neon", s));
    expect(files.get("suno/takes/darker.txt")).toMatch(/^Darker take/);
    expect(files.get("suno/takes/bigger-drop.txt")).toContain("Exclude styles:");
    expect(files.has("suno/takes/main.txt")).toBe(false); // Main is the open one: it's suno/style.txt
  });
});
