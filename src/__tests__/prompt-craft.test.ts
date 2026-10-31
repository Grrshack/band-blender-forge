import { describe, expect, it } from "vitest";

import { prompt as buildPrompt } from "@/lib/forge-prompts";
import { preflight } from "@/lib/preflight";
import {
  MIX_CLAUSES,
  addClause,
  exportLyrics,
  hasClause,
  looksLikeBrief,
  mergeExcludes,
  placeVocal,
  softVocalUnplaced,
  styleFieldSpec,
  withCleanEnding,
} from "@/lib/prompt-craft";
import { fitToLimit } from "@/lib/suno";
import { clampSunoFields } from "@/lib/forge-pipeline";

const TAGS = "indie rock, 120 bpm, jangly guitars, warm bass, male vocals, tape saturation, wistful";
const BRIEF =
  "Wistful indie rock at 120 BPM with a steady, driving feel. Jangly guitars ring out over a warm, rounded bass line. A male voice sings close and upfront above the band. Verses stay lean and the chorus opens up with stacked harmonies.";

describe("format detection", () => {
  it("tells a tag list from a brief", () => {
    expect(looksLikeBrief(TAGS)).toBe(false);
    expect(looksLikeBrief(BRIEF)).toBe(true);
    expect(looksLikeBrief("")).toBe(false);
  });
});

describe("prompts", () => {
  it("asks for a Studio Brief only when picked", () => {
    expect(styleFieldSpec("brief", 700)).toMatch(/Studio Brief/);
    expect(styleFieldSpec("tags", 700)).toMatch(/comma-separated/);
    const brief = buildPrompt("blend", { artists: ["A", "B"], promptFormat: "brief" });
    const tags = buildPrompt("blend", { artists: ["A", "B"] });
    expect(brief).toMatch(/Studio Brief/);
    expect(tags).not.toMatch(/Studio Brief/);
  });

  it("keeps the current format when revising", () => {
    expect(buildPrompt("refine", { styleTag: BRIEF, instruction: "darker" })).toMatch(/Studio Brief/);
    expect(buildPrompt("refine", { styleTag: TAGS, instruction: "darker" })).not.toMatch(/Studio Brief/);
  });

  it("feeds the symptom playbook into Fix a Track", () => {
    const p = buildPrompt("fixTake", { style: TAGS, symptoms: ["Cut off before the last lyric"] });
    expect(p).toMatch(/ran out of time/);
  });
});

describe("pre-flight", () => {
  it("doesn't count a brief's sentences as too many tags", () => {
    const long = Array(6).fill(BRIEF).join(" ").slice(0, 690);
    const issues = preflight({ style: long, exclude: "", version: "v6", artistNames: [] });
    expect(issues.some((i) => /tags is a lot|genre comes late/.test(i.message))).toBe(false);
  });

  it("flags a soft vocal with no placement, and fixes it in the same format", () => {
    const style = "dream pop, 90 bpm, shimmering synths, soft breathy female vocals";
    expect(softVocalUnplaced(style)).toBe(true);
    const issue = preflight({ style, exclude: "", version: "v6", artistNames: [] }).find((i) => i.fix === "placeVocal");
    expect(issue).toBeTruthy();
    const fixed = placeVocal(style);
    expect(fixed).toMatch(/close-miked/);
    expect(softVocalUnplaced(fixed)).toBe(false);
    expect(placeVocal(BRIEF)).toBe(BRIEF); // already placed
  });

  it("finds a negative written inside a brief", () => {
    const style = "Moody synthwave at 100 BPM. Pulsing bass under bright arps, with no drums in the verses.";
    expect(preflight({ style, exclude: "", version: "v6", artistNames: [] }).some((i) => /no drums/.test(i.message))).toBe(true);
  });
});

describe("clauses and excludes", () => {
  it("adds a clause in the style's format and merges excludes once", () => {
    const vocal = MIX_CLAUSES.find((c) => c.id === "vocal")!;
    const t = addClause(TAGS, vocal);
    expect(t.startsWith(`${TAGS}, `)).toBe(true);
    expect(hasClause(t, vocal)).toBe(true);
    const b = addClause(BRIEF, vocal);
    expect(b).toMatch(/harmonies\. The lead vocal/);
    expect(mergeExcludes("autotune, Buried vocals", "buried vocals, fade-out")).toBe("autotune, Buried vocals, fade-out");
    expect(mergeExcludes("", "fade-out", "slow fade-out ending")).toBe("");
  });

  it("cuts an overlong brief at a sentence", () => {
    expect(fitToLimit(BRIEF, 120).endsWith(".")).toBe(true);
  });
});

describe("clean ending", () => {
  it("replaces a bare outro tag with an instrumental tail and a stop", () => {
    expect(withCleanEnding("[Chorus]\nla la\n\n[Outro]")).toBe("[Chorus]\nla la\n\n[Instrumental Outro]\n[End]");
    expect(withCleanEnding("[Verse 1]\nhello")).toBe("[Verse 1]\nhello\n\n[Instrumental Outro]\n[End]");
  });
  it("keeps sung outro lines", () => {
    expect(withCleanEnding("[Outro]\ngoodbye")).toBe("[Outro]\ngoodbye\n\n[Instrumental Outro]\n[End]");
  });
});

describe("Suno box limits", () => {
  it("leaves the clean ending off when the lyrics are nearly full", () => {
    const full = `[Verse 1]\n${"la ".repeat(1660)}`.slice(0, 4990);
    const r = exportLyrics(full, true);
    expect(r.noRoom).toBe(true);
    expect(r.text).toBe(full);
    expect(exportLyrics("[Verse 1]\nhi", true).added).toBe(true);
    expect(exportLyrics("[Verse 1]\nhi", false).text).toBe("[Verse 1]\nhi");
  });

  it("never grows the style or exclude list past 1,000", () => {
    const style = `dream pop, soft breathy vocals, ${"shimmer, ".repeat(106)}`.slice(0, 990);
    expect(placeVocal(style).length).toBeLessThanOrEqual(1000);
    const ex = "x, ".repeat(330).slice(0, 995);
    expect(mergeExcludes(ex, "buried vocals, fade-out").length).toBeLessThanOrEqual(1000);
  });

  it("clamps any task's style output", () => {
    const r = clampSunoFields({ styleTag: "a, ".repeat(600), excludeStyles: "b, ".repeat(600) });
    expect((r["styleTag"] as string).length).toBeLessThanOrEqual(1000);
    expect((r["excludeStyles"] as string).length).toBeLessThanOrEqual(1000);
  });

  it("tells the lyric AI the character budget", () => {
    expect(buildPrompt("lyrics", { theme: "x" })).toMatch(/5,000 characters/);
  });
});
