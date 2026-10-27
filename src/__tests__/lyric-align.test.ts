import { describe, expect, it } from "vitest";

import heard from "./fixtures/whisper-heard.json";
import { buildLrc, checkLyrics, linesFromText, lrcTime, normWord, sunoEditFor, words } from "@/lib/lyric-align";

// What the person wrote. The test take (made with a speech voice over music) sings line 2
// differently and skips the bridge.
const written = `[Verse 1]
[Sparse]
Headlights on the overpass, coffee going cold
Six a.m. and the radio is playing old

[Chorus]
Drive me home, drive me home, before the sun gets bold
I counted every mile marker, every story told
Drive me home, drive me home (hey!), the sky is turning gold

[Bridge]
Nobody waits up for the night shift crew`;

describe("lyric check on a real Whisper transcript", () => {
  const lines = linesFromText(written);
  const r = checkLyrics(lines, heard as Array<{ text: string; start: number; end: number }>);

  it("reads sections and skips cue tags", () => {
    expect(lines).toHaveLength(6);
    expect(lines[0]).toEqual({ section: "Verse 1", text: "Headlights on the overpass, coffee going cold" });
    expect(lines[5]!.section).toBe("Bridge");
  });

  it("matches the lines that were sung as written, with times", () => {
    const first = r.lines[0]!;
    expect(first.status).toBe("ok");
    expect(first.start).toBeCloseTo(4.18, 1);
    expect(r.lines[2]!.status).toBe("ok");
    expect(r.lines[4]!.status).toBe("ok"); // the "(hey!)" ad-lib is optional
  });

  it("flags the changed line and the skipped one", () => {
    expect(r.lines[1]!.status).toBe("changed");
    expect(r.lines[1]!.heard).toMatch(/six in the morning and the radio plays old/i);
    expect(r.lines[5]!.status).toBe("missing");
    expect(r.lines[5]!.heard).toBe("");
    expect(r.issues.map((i) => i.text)).toEqual([lines[1]!.text, lines[5]!.text]);
    expect(r.accuracyPct).toBeGreaterThan(70);
    expect(r.accuracyPct).toBeLessThan(95);
  });

  it("ignores the invented 'Thank you' at the end", () => {
    expect(r.lines[4]!.heard).not.toMatch(/thank/i);
  });

  it("writes synced lyrics", () => {
    const lrc = buildLrc(r.lines, { title: "Night Shift" });
    const rows = lrc.split("\n");
    expect(rows[0]).toBe("[ti:Night Shift]");
    expect(rows).toContain("[00:04.18]Headlights on the overpass, coffee going cold");
    expect(rows.filter((x) => /^\[\d\d:\d\d\.\d\d\]/.test(x))).toHaveLength(6);
  });

  it("suggests a Suno edit for a changed line", () => {
    const tip = sunoEditFor(r.lines[1]!, (s) => `${Math.floor(s)}s`);
    expect(tip).toMatch(/should be "Six a\.m\. and the radio is playing old"/);
  });
});

describe("helpers", () => {
  it("normalises words", () => {
    expect(normWord("Don't")).toBe("dont");
    expect(normWord("6")).toBe("six");
    expect(normWord("gonna")).toBe("goingto");
    expect(words("Hey (ooh) you - there")).toEqual(["hey", "you", "there"]);
  });
  it("formats LRC times", () => {
    expect(lrcTime(83.4)).toBe("01:23.40");
    expect(lrcTime(59.999)).toBe("01:00.00");
    expect(lrcTime(0)).toBe("00:00.00");
  });
  it("handles an empty transcript as all missing", () => {
    const r = checkLyrics(linesFromText("[Verse]\nOne line here"), []);
    expect(r.lines[0]!.status).toBe("missing");
    expect(r.accuracyPct).toBe(0);
  });
});
