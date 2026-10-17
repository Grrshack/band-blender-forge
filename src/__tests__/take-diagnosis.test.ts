import { describe, expect, it } from "vitest";

import { downsample, flagsFor, measureLevels, windowLevelsDb } from "@/lib/audio/take-diagnosis";

const FS = 1000; // a low sample rate keeps the synthetic signals small

/** A sine-ish signal whose amplitude follows `amps`, one value per second. */
function signal(amps: number[]): Float32Array {
  const out = new Float32Array(amps.length * FS);
  amps.forEach((a, s) => {
    for (let i = 0; i < FS; i++) out[s * FS + i] = a * Math.sin((2 * Math.PI * 50 * i) / FS);
  });
  return out;
}

describe("windowLevelsDb", () => {
  it("returns one level per window and reads silence as very low", () => {
    const levels = windowLevelsDb(signal([0, 0.5]), FS, 1);
    expect(levels).toHaveLength(2);
    expect(levels[0]).toBeLessThan(-100);
    expect(levels[1]).toBeGreaterThan(-10);
  });
});

describe("downsample", () => {
  it("keeps short series and averages long ones", () => {
    expect(downsample([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(downsample([0, 2, 4, 6], 2)).toEqual([1, 5]);
  });
});

describe("measureLevels + flagsFor", () => {
  it("flags silence before the music, an abrupt ending and flat dynamics", () => {
    const amps = [0, 0, 0, 0, ...Array(30).fill(0.3)];
    const m = measureLevels([signal(amps)], FS);
    expect(m.leadInSec).toBe(4);
    const flags = flagsFor(m);
    expect(flags.some((f) => f.includes("silence"))).toBe(true);
    expect(flags.some((f) => f.startsWith("Abrupt ending"))).toBe(true);
    expect(flags.some((f) => f.startsWith("Flat dynamics"))).toBe(true);
  });

  it("does not flag a song that builds and fades out", () => {
    const amps = [
      ...Array(10).fill(0.08),
      ...Array(10).fill(0.4),
      ...Array(10).fill(0.1),
      ...Array(10).fill(0.45),
      0.05, 0.02, 0.005,
    ];
    const flags = flagsFor(measureLevels([signal(amps)], FS));
    expect(flags).toEqual([]);
  });

  it("flags clipping", () => {
    const clipped = new Float32Array(FS * 25).fill(1);
    const flags = flagsFor(measureLevels([clipped], FS));
    expect(flags.some((f) => f.startsWith("Clipping"))).toBe(true);
  });
});
