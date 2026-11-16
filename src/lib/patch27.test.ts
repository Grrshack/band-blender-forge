import { describe, expect, it } from "vitest";

import { switchTake, takesOf } from "./alt-takes";
import { clampSunoFields } from "./forge-pipeline";
import { applyLengthTest, lengthOfActive, ratingDetail, shortStyleOf } from "./length-test";
import { addDuet, lyricStyleChecks } from "./lyric-style-checks";
import { applyFix, checkPrompt } from "./prompt-checker";
import { addBuildAndDrop, beatSwitch, hasTwoSingers, keyChangeLastChorus, singerSwitches } from "./section-order";
import { composeSunoLyrics, cueParts, leadVocalTag, sectionHeader } from "./suno";
import type { BlendResult, Section } from "@/components/forge/types";

const line = (text: string) => ({ text, locked: false });
const song = (): Section[] => [
  { tag: "[Verse 1]", lines: [line("a"), line("b")] },
  { tag: "[Chorus]", lines: [line("c")] },
  { tag: "[Verse 2]", lines: [line("d")] },
  { tag: "[Chorus]", lines: [line("e")] },
];

describe("section tags with cues and singers inside", () => {
  it("puts the singer and cue in the tag, pipe-separated", () => {
    expect(sectionHeader({ tag: "[Chorus]", cue: "belted, full band", singer: "female" })).toBe("[Chorus | Female Vocal | Belted | Full band]");
    expect(sectionHeader({ tag: "Verse 2", cue: "" })).toBe("[Verse 2]");
    expect(cueParts("soft | soft, [airy]")).toEqual(["Soft", "Airy"]);
  });

  it("adds the lead vocal on top only when no section names a singer, and never for instrumentals", () => {
    const s = song();
    expect(composeSunoLyrics(s, { lead: "[Female Vocal]" }).startsWith("[Female Vocal]\n\n[Verse 1]\na")).toBe(true);
    const named = s.map((x, i) => (i === 2 ? { ...x, singer: "male" as const } : x));
    expect(composeSunoLyrics(named, { lead: "[Female Vocal]" }).startsWith("[Verse 1]")).toBe(true);
    expect(composeSunoLyrics([{ tag: "[Intro]", lines: [] }], { lead: "[Female Vocal]" })).toBe("[Intro]");
    expect(composeSunoLyrics(s)).not.toMatch(/\n\[[^\]|]+\]\n\[/); // no separate cue lines any more
  });

  it("takes the lead from Suno's vocal gender first, then the blend's voice tags", () => {
    expect(leadVocalTag("[Female Vocal], [Whisper]")).toBe("[Female Vocal]");
    expect(leadVocalTag("[Male Vocal]", "female")).toBe("[Female Vocal]");
    expect(leadVocalTag("[Duet]")).toBe("[Duet]");
    expect(leadVocalTag("[Whisper]")).toBe("");
  });
});

describe("song shifts", () => {
  it("adds a build and drop before the last chorus, once", () => {
    const r = addBuildAndDrop(song());
    expect(r.sections.map((s) => s.tag)).toEqual(["[Verse 1]", "[Chorus]", "[Verse 2]", "[Build]", "[Drop]", "[Chorus]"]);
    expect(addBuildAndDrop(r.sections).sections).toBe(r.sections);
  });

  it("puts a key change on the last chorus and a beat switch before verse 2", () => {
    const k = keyChangeLastChorus(song());
    expect(k.sections[3]!.cue).toBe("Key change, Stacked harmonies");
    expect(keyChangeLastChorus(k.sections).sections[3]!.cue).toBe("Key change, Stacked harmonies");
    expect(beatSwitch(song()).sections.map((s) => s.tag)).toEqual(["[Verse 1]", "[Chorus]", "[Beat Switch]", "[Verse 2]", "[Chorus]"]);
    expect(beatSwitch([{ tag: "[Chorus]", lines: [] }]).note).toMatch(/second verse or a bridge/);
  });

  it("counts singers and switches", () => {
    const s = song().map((x, i) => ({ ...x, singer: (i % 2 ? "female" : "male") as "male" | "female" }));
    expect(hasTwoSingers(s)).toBe(true);
    expect(singerSwitches(s)).toBe(3);
    expect(hasTwoSingers(song())).toBe(false);
  });
});

describe("lyrics against the style", () => {
  const duetLyrics = "[Verse 1 | Male Vocal]\na\n\n[Chorus | Female Vocal]\nb";
  it("asks for 'duet' in the style when two singers are tagged", () => {
    const issues = lyricStyleChecks("indie pop, 100 BPM, warm vocals", duetLyrics);
    expect(issues[0]?.fix).toBe("addDuet");
    expect(lyricStyleChecks("indie pop, duet, warm vocals", duetLyrics)).toEqual([]);
  });

  it("adds duet second in a tag list, after the first sentence in a brief", () => {
    expect(addDuet("indie pop, 100 BPM")).toBe("indie pop, duet, 100 BPM");
    expect(addDuet("Warm indie pop. A slow groove.")).toBe("Warm indie pop. A male and female duet. A slow groove.");
  });

  it("flags cues the style overrules, in both directions", () => {
    expect(lyricStyleChecks("anthemic rock, 140 BPM", "[Bridge | Whispered]\nx")[0]?.message).toMatch(/quiet voice.*anthemic/);
    expect(lyricStyleChecks("anthemic rock, intimate verses", "[Bridge | Whispered]\nx")).toEqual([]);
    expect(lyricStyleChecks("intimate folk, breathy vocal", "[Chorus | Belted]\nx")[0]?.message).toMatch(/big voice/);
  });

  it("reaches the Prompt Checker with a one-click fix", () => {
    const input = { title: "", style: "indie pop, 100 BPM, warm male vocal", exclude: "x", lyrics: duetLyrics, artists: [], version: "v6" as const };
    expect(checkPrompt(input).issues.some((i) => i.fix === "addDuet")).toBe(true);
    expect(applyFix(input, "addDuet").style).toBe("indie pop, duet, 100 BPM, warm male vocal");
  });
});

describe("Short vs Full length test", () => {
  const full: BlendResult = {
    styleTag: "dark synthpop, 92 BPM, analog bass, drum machine, arpeggiated synths, breathy female vocal upfront, wide stereo, melancholic",
    styleShort: "dark synthpop, melancholic, analog bass, female vocal",
    excludeStyles: "autotune",
  };

  it("adds a Short tab next to Main while the test runs", () => {
    const r = applyLengthTest(full, "both");
    expect(takesOf(r).map((t) => t.label)).toEqual(["Main", "Short"]);
    expect(r.styleTag).toBe(full.styleTag);
    expect(lengthOfActive(r, "both")).toBe("full");
    const short = switchTake(r, "short");
    expect(short.styleTag).toBe(full.styleShort);
    expect(short.excludeStyles).toBe("autotune");
    expect(lengthOfActive(short, "both")).toBe("short");
    expect(ratingDetail(4, "short")).toBe("4|short");
    expect(ratingDetail(2, "")).toBe("2");
  });

  it("turns off cleanly: full keeps the old behaviour, short replaces the style", () => {
    expect(applyLengthTest(full, "full")).toBe(full);
    expect(applyLengthTest(full, "short").styleTag).toBe(full.styleShort);
    expect(lengthOfActive(applyLengthTest(full, "both"), "full")).toBe("");
  });

  it("falls back to the first tags when the AI gave no short style, and leaves a brief alone", () => {
    const { styleShort: _drop, ...noShort } = full;
    const s = shortStyleOf(noShort);
    expect(s.startsWith("dark synthpop, 92 BPM")).toBe(true);
    expect(s.split(",").length).toBeLessThanOrEqual(7);
    expect(shortStyleOf({ styleTag: "A warm brief. Two sentences here." })).toBe("");
    expect(applyLengthTest({ styleTag: "A warm brief. Two sentences here." }, "both").altTakes).toBeUndefined();
  });

  it("clamps the AI's short style to 300 characters", () => {
    const out = clampSunoFields({ styleTag: "x", styleShort: "word, ".repeat(100) });
    expect((out["styleShort"] as string).length).toBeLessThanOrEqual(300);
  });
});
