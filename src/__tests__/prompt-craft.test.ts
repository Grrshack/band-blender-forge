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
  it("describes both formats, and every blend asks for both", () => {
    expect(styleFieldSpec("brief", 700)).toMatch(/Studio Brief/);
    expect(styleFieldSpec("tags", 700)).toMatch(/comma-separated/);
    const p = buildPrompt("blend", { artists: ["A", "B"] });
    expect(p).toMatch(/"styleTag":"a single comma-separated/);
    expect(p).toMatch(/"styleBriefParts":\{"sound":/);
    expect(p).toMatch(/never starting with the part's name/);
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

describe("two versions of one style", () => {
  it("folds a fresh result into the preferred format with the other kept", async () => {
    const { arrangeFormats, swapFormat, dropAlt, activeFormat } = await import("@/lib/prompt-craft");
    const fresh: { styleTag: string; styleBrief?: string; styleAlt?: string; styleFormat?: "tags" | "brief" } = { styleTag: TAGS, styleBrief: BRIEF };
    const asTags = arrangeFormats(fresh, "tags");
    expect(asTags).toMatchObject({ styleTag: TAGS, styleAlt: BRIEF, styleFormat: "tags" });
    expect("styleBrief" in asTags).toBe(false);
    const asBrief = arrangeFormats(fresh, "brief");
    expect(asBrief).toMatchObject({ styleTag: BRIEF, styleAlt: TAGS, styleFormat: "brief" });

    // Swapping is lossless, including edits made to the active side.
    const edited = { ...asTags, styleTag: `${TAGS}, clean modern mix` };
    const swapped = swapFormat(edited);
    expect(swapped).toMatchObject({ styleTag: BRIEF, styleFormat: "brief" });
    expect(swapFormat(swapped).styleTag).toBe(`${TAGS}, clean modern mix`);

    // An AI rewrite drops the stale alternative.
    const rewritten = dropAlt(asTags, "darker indie rock, 110 bpm");
    expect(rewritten.styleAlt).toBeUndefined();
    expect(activeFormat(rewritten)).toBe("tags");
    expect(activeFormat({ styleTag: BRIEF })).toBe("brief");
  });

  it("asks the AI for both versions and offers a format rewrite", () => {
    const blend = buildPrompt("blend", { artists: ["A", "B"] });
    expect(blend).toMatch(/"styleBriefParts"/);
    expect(buildPrompt("refine", { styleTag: TAGS, convertTo: "brief" })).toMatch(/Rewrite this Suno style prompt in a different format/);
  });
});

describe("the Studio Brief in parts", () => {
  const raw = {
    sound: "Urgent, melancholic post-hardcore with emo-punk bite",
    pulse: "The pulse is a fast 152 BPM punk drive.",
    players: "Players include dual guitars trading palm-muted riffs over a fuzzy bass and a tight kit.",
    voice: "A clean, emotive tenor sits close and upfront, breaking into stacked screams in the chorus.",
    arc: "Verses stay tense and rhythmic, then the chorus opens wide.",
    finish: "The finish is a crisp, modern room mix with clear separation.",
  };

  it("cleans robotic leads and joins the parts into one block", async () => {
    const { cleanBriefParts, joinBrief, briefMatches } = await import("@/lib/prompt-craft");
    const parts = cleanBriefParts(raw)!;
    expect(parts.sound).toBe("Urgent, melancholic post-hardcore with emo-punk bite.");
    expect(parts.pulse).toBe("A fast 152 BPM punk drive.");
    expect(parts.players!.startsWith("Dual guitars")).toBe(true);
    expect(parts.finish).toBe("A crisp, modern room mix with clear separation.");
    const text = joinBrief(parts);
    expect(text.startsWith("Urgent, melancholic post-hardcore")).toBe(true);
    expect(briefMatches(parts, text)).toBe(true);
    expect(briefMatches(parts, `${text} Extra words.`)).toBe(false);
    // Forgiving: one missing part still works, labels in any case; fewer than four is nothing.
    const five = cleanBriefParts({ ...raw, arc: "" })!;
    expect(five.arc).toBeUndefined();
    expect(joinBrief(five)).not.toMatch(/undefined/);
    expect(cleanBriefParts({ Sound: "Dark rock", PULSE: "90 BPM", Players: "Guitars", VOICE: "Low male vocal" })?.voice).toBe("Low male vocal.");
    expect(cleanBriefParts({ sound: "a", pulse: "b", voice: "c" })).toBeNull();
  });

  it("builds the brief on the server, and the style itself for a rewrite", () => {
    const blend = clampSunoFields({ styleTag: TAGS, styleBriefParts: raw });
    expect(blend["styleTag"]).toBe(TAGS);
    expect(typeof blend["styleBrief"]).toBe("string");
    expect((blend["styleBrief"] as string).startsWith("Urgent")).toBe(true);
    const rewrite = clampSunoFields({ styleBriefParts: raw });
    expect(rewrite["styleTag"]).toBe(rewrite["styleBrief"]);
    expect("styleBriefParts" in clampSunoFields({ styleTag: TAGS, styleBriefParts: { sound: "x" } })).toBe(false);
  });

  it("can split an existing brief into parts", () => {
    const p = buildPrompt("refine", { styleTag: BRIEF, splitBrief: true });
    expect(p).toMatch(/Split this Studio Brief/);
    expect(p).toMatch(/"styleBriefParts"/);
    const out = clampSunoFields({ styleBriefParts: raw });
    expect(out["styleTag"]).toMatch(/^Urgent, melancholic/);
  });

  it("keeps the parts with the brief when a result is arranged", async () => {
    const { arrangeFormats, cleanBriefParts, joinBrief } = await import("@/lib/prompt-craft");
    const fresh = clampSunoFields({ styleTag: TAGS, styleBriefParts: raw }) as { styleTag: string; styleBrief?: string; styleBriefParts?: unknown; briefParts?: import("@/lib/prompt-craft").BriefParts };
    const r = arrangeFormats(fresh, "brief");
    expect(r.styleTag).toBe(joinBrief(cleanBriefParts(raw)!));
    expect(r.briefParts?.voice).toMatch(/close and upfront/);
  });
});
