import { describe, expect, it } from "vitest";

import { findBannedWords, parseBannedWords } from "./banned-words";
import { buildEngineExport, ENGINE_LIMITS } from "./engines";

describe("banned words", () => {
  it("parses a comma list into unique lowercase entries", () => {
    expect(parseBannedWords("Alone, voice,\nalone ,  ")).toEqual(["alone", "voice"]);
  });
  it("catches whole words and plurals but not substrings", () => {
    expect(findBannedWords("All these voices", ["voice"])).toEqual(["voice"]);
    expect(findBannedWords("Standing alone tonight", ["alone"])).toEqual(["alone"]);
    expect(findBannedWords("invoice due", ["voice"])).toEqual([]);
  });
});

describe("engine export", () => {
  const input = {
    title: "T",
    style: "trip-hop, " + "dusty breakbeat, ".repeat(40),
    exclude: "autotune",
    vocal: "breathy alto",
    lyrics: "[Verse 1]\nline",
  };
  it("keeps the Udio prompt within its limit", () => {
    const prompt = buildEngineExport("udio", input).find((f) => f.label === "Prompt")!;
    expect(prompt.value.length).toBeLessThanOrEqual(ENGINE_LIMITS.udioPrompt);
  });
  it("puts lyrics and exclusions into the ElevenLabs prompt", () => {
    const p = buildEngineExport("eleven", input)[1]!.value;
    expect(p).toContain("Avoid: autotune.");
    expect(p).toContain("Lyrics:\n[Verse 1]");
  });
});
