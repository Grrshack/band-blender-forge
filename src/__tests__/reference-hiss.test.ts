import { describe, expect, it } from "vitest";

import { hissSettings } from "@/lib/audio/mastering-chain";
import { BAND_CENTERS, adviseFromReference, scaleAdvice, targetFromReference } from "@/lib/audio/spectrum";

const flat = () => BAND_CENTERS.map(() => -30);
const withBands = (base: number[], from: number, to: number, add: number) =>
  base.map((v, i) => (BAND_CENTERS[i]! >= from && BAND_CENTERS[i]! <= to ? v + add : v));

describe("full-range reference advice", () => {
  it("suggests presence when the reference is clearer at 2-5 kHz", () => {
    const song = flat();
    const ref = withBands(flat(), 2000, 5000, 4);
    const a = adviseFromReference(song, ref);
    expect(a.delta.presenceDb).toBeGreaterThan(0);
    expect(a.delta.presenceDb).toBeLessThanOrEqual(3);
    expect(a.lines.some((l) => /presence/.test(l))).toBe(true);
  });

  it("turns a too-bright top end into the hiss tamer, not a negative air boost", () => {
    const song = withBands(flat(), 8000, 16000, 6);
    const a = adviseFromReference(song, flat());
    expect(a.delta.airDb).toBe(0);
    expect(a.delta.deHiss).toBeGreaterThanOrEqual(0.2);
    expect(a.delta.deHiss).toBeLessThanOrEqual(0.8);
  });

  it("leaves a matching song alone", () => {
    const a = adviseFromReference(flat(), flat());
    expect(a.delta).toMatchObject({ bassGainDb: 0, midDb: 0, presenceDb: 0, deHiss: 0, airDb: 0 });
  });

  it("scales moves by the match amount", () => {
    const d = { bassGainDb: 4, lowMidCutDb: -2, airDb: 2, subCutHz: 28, midDb: 2, presenceDb: -2, deHiss: 0.6 };
    expect(scaleAdvice(d, 0.5)).toEqual({ bassGainDb: 2, lowMidCutDb: -1, airDb: 1, subCutHz: 28, midDb: 1, presenceDb: -1, deHiss: 0.3 });
    expect(scaleAdvice(d, 0.25).subCutHz).toBeNull();
  });

  it("keeps a reference loudness target sensible", () => {
    expect(targetFromReference(-8.3)).toBe(-8.5);
    expect(targetFromReference(-4)).toBe(-7);
    expect(targetFromReference(-22)).toBe(-16);
    expect(targetFromReference(Number.NEGATIVE_INFINITY)).toBeNull();
  });
});

describe("hiss tamer settings", () => {
  it("is transparent at 0 and undoes the compressor's automatic make-up gain", () => {
    expect(hissSettings(0)).toEqual({ thresholdDb: -18, ratio: 1, makeupDb: 0, shelfDb: -0 });
    const h = hissSettings(1);
    expect(h.thresholdDb).toBe(-42);
    expect(h.ratio).toBe(8);
    // Spec make-up: 0.6 x the gain reduction at 0 dBFS = 0.6 x 42 x (1 - 1/8).
    expect(h.makeupDb).toBeCloseTo(22.05, 2);
    expect(h.shelfDb).toBe(-3);
  });
});
