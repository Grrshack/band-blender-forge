import { describe, expect, it } from "vitest";
import { analyzeSection, endWord, lyricStyleRules, rhymeKind } from "@/lib/rhyme";

describe("end words", () => {
  it("ignores punctuation, ad-libs and tags", () => {
    expect(endWord("I can't feel my arm (oh no)")).toBe("arm");
    expect(endWord("Shut the door!")).toBe("door");
    expect(endWord("it's my friend's")).toBe("friend");
  });
});

describe("rhyme kinds", () => {
  it.each([
    ["arm", "harm", "perfect"],
    ["door", "more", "perfect"],
    ["night", "bite", "perfect"],
    ["time", "rhyme", "perfect"],
    ["rain", "plane", "perfect"],
    ["stone", "alone", "perfect"],
    ["sky", "lie", "perfect"],
    ["mouth", "out", "near"],
    ["home", "alone", "near"],
    ["door", "car", "none"],
    ["door", "for", "perfect"],
    ["door", "mirror", "none"],
    ["hour", "four", "none"],
    ["now", "know", "none"],
    ["again", "again", "repeat"],
    ["read", "heart", "none"],
    ["read", "head", "perfect"],
    ["said", "bed", "perfect"],
    ["heart", "apart", "perfect"],
    ["fear", "near", "perfect"],
    ["wear", "there", "perfect"],
    ["love", "above", "perfect"],
    ["love", "move", "none"],
    ["come", "drum", "perfect"],
    ["one", "sun", "perfect"],
  ])("%s / %s → %s", (a, b, kind) => {
    expect(rhymeKind(a, b)).toBe(kind);
  });
});

describe("sections", () => {
  it("finds AABB and flags the one-syllable perfect-rhyme trap", () => {
    const r = analyzeSection([
      "You left a bruise along my arm",
      "Said you never meant me harm",
      "Now I'm staring at the door",
      "Wondering what I'm waiting for",
    ]);
    expect(r.scheme).toBe("AABB");
    expect(r.trap).toBe(true);
  });

  it("finds ABAB", () => {
    expect(
      analyzeSection(["I walk the night", "with nowhere to go", "the city light", "is all I know"]).scheme,
    ).toBe("ABAB");
  });

  it("doesn't flag conversational lines", () => {
    const r = analyzeSection([
      "You texted me at three like nothing happened",
      "and I read it in the parking lot",
      "with your hoodie still in my back seat",
      "I'm not giving it back",
    ]);
    expect(r.trap).toBe(false);
    expect(r.scheme).toBe("ABCD");
  });

  it("near rhymes share a letter but aren't the trap", () => {
    const r = analyzeSection(["words in my mouth", "I want them out", "I hold my breath", "until there's nothing left"]);
    expect(r.lines[1]!.kind).toBe("near");
    expect(r.trap).toBe(false);
  });
});

describe("prompt rules", () => {
  it("adds nothing for the defaults", () => {
    expect(lyricStyleRules("classic", "polished")).toBe("");
    expect(lyricStyleRules(undefined, undefined)).toBe("");
  });
  it("names the trap and the raw voice", () => {
    const r = lyricStyleRules("minimal", "raw");
    expect(r).toMatch(/arm\/harm/);
    expect(r).toMatch(/diary/);
  });
});

import { geminiPrompt, buildEngineExport } from "@/lib/engines";

describe("Gemini / Flow export", () => {
  const input = {
    title: "Rain", style: "post-hardcore, 150 bpm, screamed choruses", exclude: "autotune", vocal: "strained male vocal",
    genre: "Post-hardcore", tempo: "150 bpm", mood: "frustrated", instrumentation: "distorted guitars", lyrics: "[Verse 1]\nline one",
  };
  it("writes one plain request with the lyrics and tags inside", () => {
    const p = geminiPrompt(input);
    expect(p.startsWith("Create a full song in the style of post-hardcore music, 150 bpm.")).toBe(true);
    expect(p).toContain("Avoid: autotune.");
    expect(p).toContain("[Verse 1]\nline one");
  });
  it("asks for an instrumental when there are no lyrics", () => {
    expect(geminiPrompt({ ...input, lyrics: "" })).toMatch(/Make it instrumental\.$/);
  });
  it("has no invented character limit", () => {
    expect(buildEngineExport("gemini", input)[0]!.max).toBeUndefined();
  });
});
