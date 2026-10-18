import { describe, expect, it } from "vitest";

import { masteringVerdict } from "@/lib/audio/mastering-verdict";
import type { TakeMeasurements } from "@/lib/audio/take-diagnosis";

function song(over: Partial<TakeMeasurements> & { bands?: Partial<TakeMeasurements["spectrum"]["bands"]>; rmsDb?: number } = {}): TakeMeasurements {
  const { bands, rmsDb, ...rest } = over;
  return {
    durationSec: 180,
    clippedPercent: 0,
    contourDb: [],
    contrastDb: 8,
    leadInSec: 0,
    endTailDb: -20,
    flags: [],
    spectrum: {
      peakDb: -1,
      rmsDb: rmsDb ?? -12,
      dynamicRangeDb: 11,
      lowPeakHz: 50,
      analyzedSeconds: 30,
      bands: { sub: -7, bass: -3, lowMid: -9, mid: -9, highMid: -15, air: -26, ...bands },
    },
    ...rest,
  };
}

describe("masteringVerdict", () => {
  it("says nothing major for a balanced song", () => {
    const v = masteringVerdict(song());
    expect(v).toHaveLength(1);
    expect(v[0]!.kind).toBe("ok");
  });

  it("marks quiet and boomy as fixable here, with presets", () => {
    const v = masteringVerdict(song({ rmsDb: -24, bands: { sub: -1 } }));
    expect(v.find((i) => i.title.startsWith("Quieter"))?.kind).toBe("fix");
    expect(v.find((i) => i.title === "Heavy low end")?.preset).toBe("Suno v6 starter");
  });

  it("routes flat dynamics, abrupt endings and a missing top end elsewhere", () => {
    const v = masteringVerdict(song({ contrastDb: 1.5, endTailDb: -2, bands: { air: -40 } }));
    const elsewhere = v.filter((i) => i.kind === "elsewhere").map((i) => i.title);
    expect(elsewhere).toEqual([
      "Very little real top end",
      "Flat, squashed dynamics",
      "Song stops abruptly",
    ]);
  });

  it("only partly fixes clipping", () => {
    expect(masteringVerdict(song({ clippedPercent: 0.5 }))[0]!.kind).toBe("partly");
  });

  it("skips full-mix spectrum checks on a single stem", () => {
    const v = masteringVerdict(song({ bands: { sub: 2, air: -50 } }), "bass");
    expect(v.some((i) => i.title === "Heavy low end" || i.title.startsWith("Very little"))).toBe(false);
  });
});
