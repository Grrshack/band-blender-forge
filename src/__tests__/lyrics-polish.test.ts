import { describe, expect, it, vi } from "vitest";

import { runPipeline, sameShape } from "@/lib/forge-pipeline";

const draft = {
  title: "Night Shift",
  sections: [
    { tag: "[Verse 1]", cue: "Sparse", lines: ["Headlights on the overpass", "Coffee going cold"] },
    { tag: "[Chorus]", lines: ["Drive me home, drive me home", "Six a.m. and all alone"] },
  ],
};
const polished = {
  title: "Six A.M.",
  sections: [
    { tag: "[Verse 9]", lines: ["Sodium lights on the overpass", "Paper cup gone cold"] },
    { tag: "[Chorus]", lines: ["Drive me home, drive me home", "Six a.m., the sky turns gold"] },
  ],
};
const deps = (answers: unknown[], polish: boolean) => {
  const ask = vi.fn(async () => answers.shift() as Record<string, unknown>);
  return { ask, deps: { ask, lookup: async () => [], shouldPolish: () => polish } };
};

describe("lyrics polish pass", () => {
  it("uses the editor's words but keeps the draft's tags and cues", async () => {
    const { ask, deps: d } = deps([structuredClone(draft), structuredClone(polished)], true);
    const r = await runPipeline("lyrics", { theme: "nurse" }, d);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(r["title"]).toBe("Six A.M.");
    expect(r["polished"]).toBe(true);
    const sections = r["sections"] as Array<{ tag: string; cue?: string; lines: string[] }>;
    expect(sections[0]!.tag).toBe("[Verse 1]");
    expect(sections[0]!.cue).toBe("Sparse");
    expect(sections[1]!.lines[1]).toBe("Six a.m., the sky turns gold");
  });

  it("keeps the draft if the editor changed the structure", async () => {
    const broken = { title: "x", sections: [{ tag: "[Verse 1]", lines: ["only one line"] }] };
    const { deps: d } = deps([structuredClone(draft), broken], true);
    const r = await runPipeline("lyrics", {}, d);
    expect(r["title"]).toBe("Night Shift");
    expect(r["polished"]).toBeUndefined();
  });

  it("keeps the draft if the polish call fails", async () => {
    const ask = vi.fn().mockResolvedValueOnce(structuredClone(draft)).mockRejectedValueOnce(new Error("busy"));
    const r = await runPipeline("lyrics", {}, { ask, lookup: async () => [], shouldPolish: () => true });
    expect(r["title"]).toBe("Night Shift");
  });

  it("skips the pass for stronger models and structure-only mode", async () => {
    const a = deps([structuredClone(draft)], false);
    await runPipeline("lyrics", {}, a.deps);
    expect(a.ask).toHaveBeenCalledTimes(1);
    const b = deps([{ title: "t", sections: [{ tag: "[Verse 1]", lines: [] }] }], true);
    await runPipeline("lyrics", { tagsOnly: true }, b.deps);
    expect(b.ask).toHaveBeenCalledTimes(1);
  });

  it("sameShape compares section and line counts", () => {
    expect(sameShape(draft.sections, polished.sections)).toBe(true);
    expect(sameShape(draft.sections, polished.sections.slice(0, 1))).toBe(false);
  });
});
