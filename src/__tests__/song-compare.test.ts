import { describe, expect, it } from "vitest";

import type { SongAnalysis } from "@/lib/audio/song-analysis";
import { BAND_CENTERS } from "@/lib/audio/spectrum";
import { compareSongs, dynamicRange, stereoWidth, tempoGap, type CompareMeasure } from "@/lib/audio/song-compare";

const flat = () => BAND_CENTERS.map(() => -30);

function song(over: Partial<CompareMeasure> & { analysis?: Partial<SongAnalysis> } = {}): CompareMeasure {
  const analysis: SongAnalysis = {
    durationSec: 180,
    bpm: 120,
    key: { label: "A minor", tonic: "A", mode: "minor", confidence: "high", alternative: "C major" },
    sections: [
      { start: 0, end: 16, energy: "low", bars: 8, guess: "Intro" },
      { start: 16, end: 48, energy: "mid", bars: 16, guess: "Verse" },
      { start: 48, end: 80, energy: "high", bars: 16, guess: "Chorus or drop" },
      { start: 80, end: 112, energy: "mid", bars: 16, guess: "Verse" },
      { start: 112, end: 180, energy: "high", bars: 34, guess: "Chorus or drop" },
    ],
    loudnessLufs: -10,
    tone: { bass: "balanced", brightness: "balanced", loudness: "typical" },
    ...over.analysis,
  };
  const highs = analysis.sections.filter((s) => s.energy === "high");
  return {
    bandsDb: flat(),
    rangeDb: 6,
    widthPct: 40,
    peakDb: -1,
    firstLiftSec: highs[0]?.start ?? null,
    lifts: highs.length,
    ...over,
    analysis,
  };
}

describe("compareSongs", () => {
  it("finds nothing to change when the songs match", () => {
    const r = compareSongs(song(), song());
    expect(r.rows.filter((x) => x.status === "differs")).toEqual([]);
    expect(r.matchPct).toBe(100);
  });

  it("flags a late first lift and a long intro, pointing to Fix a Track", () => {
    const late = song({
      analysis: {
        sections: [
          { start: 0, end: 40, energy: "low", bars: 20, guess: "Intro" },
          { start: 40, end: 72, energy: "mid", bars: 16, guess: "Verse" },
          { start: 72, end: 180, energy: "high", bars: 54, guess: "Chorus or drop" },
        ],
      },
    });
    const r = compareSongs(late, song());
    const lift = r.rows.find((x) => x.id === "lift")!;
    expect(lift.status).toBe("differs");
    expect(lift.yours).toBe("1:12");
    expect(lift.theirs).toBe("0:48");
    expect(lift.tip).toMatch(/24 s later/);
    expect(lift.tool).toBe("fix");
    expect(r.rows.find((x) => x.id === "intro")!.status).toBe("differs");
    expect(r.matchPct).toBeLessThan(100);
  });

  it("says when your song never lifts", () => {
    const flatSong = song({
      analysis: { sections: [{ start: 0, end: 180, energy: "mid", bars: 90, guess: "Verse" }] },
    });
    const lift = compareSongs(flatSong, song()).rows.find((x) => x.id === "lift")!;
    expect(lift.yours).toBe("never");
    expect(lift.tip).toMatch(/never clearly lifts/);
  });

  it("treats half and double time as the same tempo", () => {
    expect(tempoGap(90, 180)).toBe(0);
    const r = compareSongs(song({ analysis: { bpm: 60 } }), song());
    expect(r.rows.find((x) => x.id === "tempo")!.status).toBe("close");
    const off = compareSongs(song({ analysis: { bpm: 100 } }), song());
    expect(off.rows.find((x) => x.id === "tempo")!.tip).toMatch(/120 bpm/);
  });

  it("sends a quieter master to Mastering", () => {
    const quiet = compareSongs(song({ analysis: { loudnessLufs: -16 } }), song());
    const row = quiet.rows.find((x) => x.id === "loudness")!;
    expect(row.status).toBe("differs");
    expect(row.tool).toBe("master");
    expect(row.tip).toMatch(/6 dB quieter/);
  });

  it("compares tone using the reference advice", () => {
    const bassy = flat().map((v, i) => (BAND_CENTERS[i]! >= 40 && BAND_CENTERS[i]! <= 125 ? v + 8 : v));
    const row = compareSongs(song(), song({ bandsDb: bassy })).rows.find((x) => x.id === "tone")!;
    expect(row.status).toBe("differs");
    expect(row.tip).toMatch(/more bass/);
  });

  it("never labels the key as something to fix", () => {
    const other = song({ analysis: { key: { label: "E major", tonic: "E", mode: "major", confidence: "high", alternative: "C# minor" } } });
    expect(compareSongs(other, song()).rows.find((x) => x.id === "key")!.status).toBe("info");
  });
});

describe("measurements", () => {
  it("dynamic range is bigger for a song with quiet and loud parts", () => {
    const steady = Array.from({ length: 60 }, () => -12);
    const varied = Array.from({ length: 60 }, (_, i) => (i % 20 < 10 ? -24 : -10));
    expect(dynamicRange(steady)).toBe(0);
    expect(dynamicRange(varied)!).toBeGreaterThan(10);
  });

  it("stereo width is 0 for mono and higher for a wide file", () => {
    const n = 4000;
    const a = Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10));
    const b = Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10 + 1.2));
    expect(stereoWidth([a])).toBe(0);
    expect(stereoWidth([a, a])).toBe(0);
    expect(stereoWidth([a, b])!).toBeGreaterThan(30);
  });
});
