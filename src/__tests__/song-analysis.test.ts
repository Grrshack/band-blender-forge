import { describe, expect, it } from "vitest";
import {
  analyzeSong,
  chromagram,
  detectKey,
  findSections,
  measuredForPrompt,
  structureFromSections,
  sunoTags,
} from "@/lib/audio/song-analysis";

const FS = 22050;
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Plays chords (MIDI notes) one after another, each `sec` long, with a few harmonics. */
function chords(progression: number[][], sec: number, reps = 1): Float32Array {
  const per = Math.floor(sec * FS);
  const out = new Float32Array(per * progression.length * reps);
  let pos = 0;
  for (let r = 0; r < reps; r++)
    for (const chord of progression) {
      for (let i = 0; i < per; i++) {
        let v = 0;
        for (const m of chord) {
          const f = midiHz(m);
          v += Math.sin((2 * Math.PI * f * i) / FS) + 0.3 * Math.sin((4 * Math.PI * f * i) / FS);
        }
        out[pos + i] = (0.15 * v) / chord.length;
      }
      pos += per;
    }
  return out;
}

describe("key detection", () => {
  it("finds C major from a I–IV–V–I progression", () => {
    const x = chords([[48, 60, 64, 67], [53, 65, 69, 72], [55, 67, 71, 74], [48, 60, 64, 67]], 1.5, 3);
    const k = detectKey(chromagram(x, FS))!;
    expect(k.label).toBe("C major");
  });

  it("finds A minor from an i–iv–v–i progression", () => {
    const x = chords([[45, 57, 60, 64], [50, 62, 65, 69], [52, 64, 67, 71], [45, 57, 60, 64]], 1.5, 3);
    const k = detectKey(chromagram(x, FS))!;
    expect(k.label).toBe("A minor");
  });

  it("returns null for silence", () => {
    expect(detectKey(chromagram(new Float32Array(FS * 4), FS))).toBeNull();
  });
});

describe("sections", () => {
  // 120 bpm → 2-second bars. Quiet intro, verse, loud chorus, verse, loud chorus, quiet outro.
  const levels = [
    ...Array(16).fill(-30),
    ...Array(32).fill(-18),
    ...Array(32).fill(-10),
    ...Array(32).fill(-18),
    ...Array(32).fill(-10),
    ...Array(16).fill(-30),
  ];
  const secs = findSections(levels, 120);

  it("finds the six parts in order with bar counts", () => {
    expect(secs.map((s) => s.energy)).toEqual(["low", "mid", "high", "mid", "high", "low"]);
    expect(secs.map((s) => s.bars)).toEqual([8, 16, 16, 16, 16, 8]);
    expect(secs[0]!.guess).toBe("Intro");
    expect(secs[2]!.guess).toBe("Chorus or drop");
    expect(secs[5]!.guess).toBe("Outro");
  });

  it("becomes a Lyric Forge plan", () => {
    expect(structureFromSections(secs)).toBe(
      "[Intro] instrumental, 8 bars, no lyric lines; [Verse 1] 8 lines (16 bars); [Chorus] 8 lines (16 bars); [Verse 2] 8 lines (16 bars); [Chorus] 8 lines (16 bars); [Outro] instrumental, 8 bars, no lyric lines",
    );
  });

  it("ignores a short dip instead of starting a new section", () => {
    const withFill = [...Array(30).fill(-18), -40, -40, ...Array(30).fill(-18)];
    expect(findSections(withFill, 120)).toHaveLength(1);
  });

  it("works without a tempo (no bar counts)", () => {
    expect(findSections(levels, null).every((s) => s.bars === null)).toBe(true);
  });
});

describe("whole-song analysis", () => {
  it("measures tempo, key and length from a pulsing A-minor loop", () => {
    // 4 chords × 2 s at 120 bpm, with a click every beat for the tempo detector.
    const x = chords([[45, 57, 60, 64], [50, 62, 65, 69], [52, 64, 67, 71], [45, 57, 60, 64]], 2, 4);
    const beat = Math.floor(FS * 0.5);
    for (let i = 0; i < x.length; i += beat) for (let j = 0; j < 200 && i + j < x.length; j++) x[i + j]! += 0.6 * Math.exp(-j / 40);
    const a = analyzeSong([x, x], FS);
    expect(Math.round(a.durationSec)).toBe(32);
    expect([60, 120, 240]).toContain(a.bpm);
    expect(a.key?.label).toBe("A minor");
    expect(sunoTags(a)).toMatch(/bpm/);
    const m = measuredForPrompt(a);
    expect(m.length).toBe("0:32");
    expect(m.sections.length).toBeGreaterThan(0);
  });
});
