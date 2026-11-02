import { describe, expect, it } from "vitest";
import { barsFromPlan, bpmFrom, clock, sectionTimes } from "./section-times";
import { packSlug, songPackFiles } from "./song-pack";
import { buildZip, crc32 } from "./zip";
import { planSong } from "./planner";
import { emptyState, type ForgeState } from "@/components/forge/types";

const line = (text: string) => ({ text }) as never;

describe("section times", () => {
  it("reads tempo from the style, a bare number, or not at all", () => {
    expect(bpmFrom("dark synthpop, 92 bpm, analog")).toBe(92);
    expect(bpmFrom(undefined, "Tempo is BPM 140")).toBe(140);
    expect(bpmFrom("96")).toBe(96);
    expect(bpmFrom("85–90 BPM half-time")).toBe(85);
    expect(bpmFrom("no tempo here", "")).toBeNull();
    expect(bpmFrom("999 bpm")).toBeNull();
  });

  it("uses about 2 bars per line and 8 for an instrumental part", () => {
    const t = sectionTimes(
      [
        { tag: "[Intro]", lines: [] },
        { tag: "[Verse 1]", lines: [line("a"), line("b"), line("c"), line("d")] },
      ],
      { bpm: 120 },
    );
    // 120 BPM: one bar = 2 s
    expect(t.sections.map((s) => s.bars)).toEqual([8, 8]);
    expect(t.sections[1]).toMatchObject({ start: 16, end: 32 });
    expect(t.totalSec).toBe(32);
    expect(t.bpmGuessed).toBe(false);
  });

  it("follows the length plan when its sections match", () => {
    const plan = planSong({ seconds: 180, bpm: 100, template: "pop" });
    const bars = barsFromPlan(plan.text);
    expect(bars).toEqual(plan.sections.map((s) => s.bars));
    const secs = plan.sections.map((s) => ({ tag: s.tag, lines: Array.from({ length: s.lines }, () => line("x")) }));
    const t = sectionTimes(secs, { bpm: 100, plan: plan.text });
    expect(t.fromPlan).toBe(true);
    expect(t.totalSec).toBeCloseTo(plan.totalSeconds, 6);
    // A plan that doesn't match falls back to lines
    expect(sectionTimes(secs.slice(1), { bpm: 100, plan: plan.text }).fromPlan).toBe(false);
  });

  it("guesses 100 BPM when none is known and formats the clock", () => {
    expect(sectionTimes([{ tag: "[Verse]", lines: [] }]).bpm).toBe(100);
    expect(clock(0)).toBe("0:00");
    expect(clock(75.4)).toBe("1:15");
    expect(clock(600)).toBe("10:00");
  });
});

describe("zip writer", () => {
  it("matches the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes a valid archive with UTF-8 names", () => {
    const zip = buildZip([
      { name: "a/one.txt", data: "hello" },
      { name: "b/canción.txt", data: "ñ" },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cdOffset = v.getUint32(end + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(zip)).toContain("b/canción.txt");
  });
});

describe("song pack", () => {
  const state = (): ForgeState => {
    const s = emptyState();
    s.blend.artists = ["Artist A", "Artist B"];
    s.blend.result = {
      styleTag: "dark synthpop, 92 bpm, breathy female vocals",
      styleAlt: "The sound is dark synthpop. The pulse is 92 BPM.",
      styleFormat: "tags",
      excludeStyles: "autotune",
      tempo: "92 BPM",
    };
    s.lyrics.title = "Neon Rain";
    s.lyrics.sections = [
      { tag: "[Verse 1]", lines: [line("first line"), line("second line")] },
      { tag: "[Chorus]", lines: [line("hook line")] },
    ];
    s.release = { lrc: "[00:01.00]first line", disclosure: { lyrics: "all", music: "all", vocals: "all", artwork: "none" } as never };
    return s;
  };

  it("puts each Suno box in its own file and lists them in the README", () => {
    const files = new Map(songPackFiles("Neon Rain", state()));
    expect(files.get("suno/title.txt")).toBe("Neon Rain\n");
    expect(files.get("suno/style.txt")).toContain("92 bpm");
    expect(files.get("suno/style-brief.txt")).toContain("The sound is");
    expect(files.get("suno/exclude.txt")).toBe("autotune\n");
    expect(files.get("suno/lyrics.txt")).toContain("[Chorus]");
    expect(files.get("suno/lyrics.txt")!.length).toBeLessThanOrEqual(5001);
    expect(files.get("lyrics/lyrics.lrc")).toContain("first line");
    expect(files.get("lyrics/timeline.txt")).toContain("92 BPM");
    expect(files.get("release/ai-disclosure.txt")).toContain("DistroKid");
    expect(files.get("brief.md")).toContain("# Neon Rain");
    const readme = files.get("README.txt")!;
    for (const path of files.keys()) if (path !== "README.txt") expect(readme).toContain(path);
  });

  it("leaves out what doesn't exist yet", () => {
    const files = new Map(songPackFiles("Empty", emptyState()));
    expect([...files.keys()].sort()).toEqual(["README.txt", "brief.md", "suno/title.txt"]);
  });

  it("makes safe folder names", () => {
    expect(packSlug("Canción de Café!")).toBe("cancion-de-cafe");
    expect(packSlug("   ")).toBe("song");
  });
});

describe("song pack robustness", () => {
  it("skips a disclosure it can't read instead of failing", () => {
    const s = emptyState();
    s.lyrics.title = "Odd";
    s.release = { disclosure: { lyrics: "some", music: "all", vocals: "all", artwork: "none" } as never };
    const files = new Map(songPackFiles("Odd", s));
    expect(files.has("release/ai-disclosure.txt")).toBe(false);
  });
});
