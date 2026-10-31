import { describe, expect, it } from "vitest";

import { chatMessage } from "@/lib/ai-chat";
import { beatPulse, loopSeconds } from "@/lib/spotify-canvas";

describe("Spotify Canvas loop length", () => {
  it("is a whole number of bars between 3 and 8 seconds, near 6", () => {
    expect(loopSeconds(120)).toBe(6); // 3 bars of 2 s
    expect(loopSeconds(90)).toBeCloseTo(5.333, 2); // 2 bars
    for (const bpm of [60, 75, 84, 100, 128, 140, 174, 200]) {
      const s = loopSeconds(bpm);
      expect(s).toBeGreaterThanOrEqual(3);
      expect(s).toBeLessThanOrEqual(8);
      const bars = s / ((4 * 60) / bpm);
      expect(Math.abs(bars - Math.round(bars))).toBeLessThan(0.01);
    }
  });

  it("falls back to 6 s without a tempo, and to whole beats for very slow songs", () => {
    expect(loopSeconds(null)).toBe(6);
    const slow = loopSeconds(45); // one bar is 5.33 s, fine
    expect(slow).toBeLessThanOrEqual(8);
  });

  it("pulses identically at the start and end of the loop", () => {
    const loop = loopSeconds(128);
    const beat = 60 / 128;
    expect(beatPulse(0, beat)).toBeCloseTo(beatPulse(loop, beat), 6);
    expect(beatPulse(0, beat)).toBe(1);
  });
});

describe("Send to AI chat", () => {
  it("includes every field and asks for them unchanged", () => {
    const m = chatMessage({ title: "Night Shift", style: "dark trip-hop", exclude: "autotune", lyrics: "[Verse 1]\nHeadlights" });
    expect(m).toMatch(/Suno connector/);
    expect(m).toMatch(/exactly as written/);
    expect(m).toMatch(/Title: Night Shift/);
    expect(m).toMatch(/Exclude styles:\nautotune/);
    expect(m).toMatch(/\[Verse 1\]\nHeadlights/);
  });

  it("asks for an instrumental when there are no lyrics, and respects Suno's limits", () => {
    const m = chatMessage({ title: "", style: "x".repeat(1500), exclude: "", lyrics: "" });
    expect(m).toMatch(/instrumental/);
    expect(m).not.toMatch(/Exclude styles/);
    expect(m.match(/x{2,}/)![0].length).toBe(1000);
  });
});
