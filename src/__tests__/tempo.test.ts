import { describe, expect, it } from "vitest";

import { estimateBpm } from "@/lib/audio/tempo";

const FS = 22050;

/** A kick-like click on every beat (and a quieter hat on off-beats) for `seconds`. */
function clickTrack(bpm: number, seconds: number, offbeats = true): Float32Array {
  const out = new Float32Array(FS * seconds);
  const beat = (60 / bpm) * FS;
  const hit = (at: number, amp: number) => {
    for (let i = 0; i < 800 && at + i < out.length; i++) {
      out[Math.floor(at) + i] = amp * Math.exp(-i / 150) * Math.sin(i / 3);
    }
  };
  for (let t = 0; t < out.length; t += beat) {
    hit(t, 0.9);
    if (offbeats) hit(t + beat / 2, 0.3);
  }
  return out;
}

describe("estimateBpm", () => {
  it.each([90, 100, 128, 140, 160])("finds %i BPM within 2", (bpm) => {
    const got = estimateBpm(clickTrack(bpm, 12), FS);
    expect(got).not.toBeNull();
    expect(Math.abs(got! - bpm)).toBeLessThanOrEqual(2);
  });

  it("reads a slow beat as itself or its double time (the UI shows both)", () => {
    const got = estimateBpm(clickTrack(75, 12), FS)!;
    expect([75, 150].some((b) => Math.abs(got - b) <= 2)).toBe(true);
  });

  it("returns null for clips under about 4 seconds", () => {
    expect(estimateBpm(clickTrack(120, 2), FS)).toBeNull();
  });

  it("returns null for silence", () => {
    expect(estimateBpm(new Float32Array(FS * 8), FS)).toBeNull();
  });
});
