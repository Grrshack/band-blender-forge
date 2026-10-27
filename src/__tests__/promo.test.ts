import { describe, expect, it } from "vitest";

import type { SongAnalysis } from "@/lib/audio/song-analysis";
import { clipCandidates, lineAt, linesInClip, parseLrc } from "@/lib/promo";

const song: SongAnalysis = {
  durationSec: 180,
  bpm: 120, // one bar = 2 s
  key: null,
  loudnessLufs: -10,
  tone: { bass: "balanced", brightness: "balanced", loudness: "typical" },
  sections: [
    { start: 0, end: 16, energy: "low", bars: 8, guess: "Intro" },
    { start: 16, end: 48, energy: "mid", bars: 16, guess: "Verse" },
    { start: 48, end: 80, energy: "high", bars: 16, guess: "Chorus or drop" },
    { start: 80, end: 112, energy: "mid", bars: 16, guess: "Verse" },
    { start: 112, end: 176, energy: "high", bars: 32, guess: "Chorus or drop" },
    { start: 176, end: 180, energy: "low", bars: 2, guess: "Outro" },
  ],
};

describe("clip finder", () => {
  it("starts one bar before the first big lift", () => {
    const c = clipCandidates(song, 15);
    expect(c[0]).toMatchObject({ start: 46, end: 61, label: "First big lift" });
    expect(c[1]).toMatchObject({ start: 110, label: "Last big section" });
  });
  it("keeps the clip inside the song", () => {
    const c = clipCandidates({ ...song, durationSec: 60, sections: [{ start: 50, end: 60, energy: "high", bars: 5, guess: "" }] }, 30);
    expect(c[0]!.end).toBe(60);
  });
  it("falls back to the busiest stretch", () => {
    const flat = { ...song, sections: song.sections.map((s) => ({ ...s, energy: s.energy === "high" ? ("mid" as const) : s.energy })) };
    expect(clipCandidates(flat, 15)[0]!.label).toBe("Fullest part");
  });
});

describe("synced lyrics in a clip", () => {
  const lrc = "[ti:Night]\n[00:44.00]Six a.m.\n[00:48.50]Drive me home\n[00:53.20]The sky is gold\n[01:10.00]Later";
  const lines = parseLrc(lrc);
  it("parses LRC", () => {
    expect(lines).toHaveLength(4);
    expect(lines[1]).toEqual({ time: 48.5, text: "Drive me home" });
  });
  it("finds the line at a time", () => {
    expect(lineAt(lines, 50)).toBe("Drive me home");
    expect(lineAt(lines, 10)).toBe("");
  });
  it("shifts lines into the clip", () => {
    expect(linesInClip(lines, 46, 61)).toEqual([
      { time: 0, text: "Six a.m." },
      { time: 2.5, text: "Drive me home" },
      { time: expect.closeTo(7.2, 5), text: "The sky is gold" },
    ]);
  });
});
