import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyState } from "@/components/forge/types";
import { MAX_LOCAL_SONGS, getLocalSong, isLocalId, listLocalSongs, saveLocalSong } from "@/lib/local-songs";
import { canEncodeMp3, encodeMp3, floatToInt16 } from "@/lib/audio/mp3-encode";

function memoryStorage(limitChars = Infinity) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limitChars) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe("local songs", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));

  it("saves, updates in place and lists newest first", () => {
    let t = 5000;
    const now = vi.spyOn(Date, "now").mockImplementation(() => t++);
    const a = saveLocalSong(null, "A", emptyState());
    expect(a.ok).toBe(true);
    expect(isLocalId(a.song.id)).toBe(true);
    const b = saveLocalSong(null, "B", emptyState());
    saveLocalSong(a.song.id, "A2", emptyState());
    const names = listLocalSongs().map((s) => s.name);
    expect(names).toEqual(["A2", "B"]);
    expect(getLocalSong(b.song.id)?.name).toBe("B");
    now.mockRestore();
  });

  it("keeps the most recently edited songs when over the limit", () => {
    const now = vi.spyOn(Date, "now");
    let t = 1000;
    now.mockImplementation(() => t++);
    const first = saveLocalSong(null, "oldest-created", emptyState());
    for (let i = 1; i < MAX_LOCAL_SONGS; i++) saveLocalSong(null, `song ${i}`, emptyState());
    saveLocalSong(first.song.id, "oldest-created", emptyState()); // edited recently
    const res = saveLocalSong(null, "newest", emptyState());
    expect(res.dropped).toBe("song 1");
    const names = listLocalSongs().map((s) => s.name);
    expect(names).toHaveLength(MAX_LOCAL_SONGS);
    expect(names).toContain("oldest-created");
    expect(names).not.toContain("song 1");
    now.mockRestore();
  });

  it("reports when the browser refuses to store", () => {
    vi.stubGlobal("localStorage", memoryStorage(10));
    expect(saveLocalSong(null, "A", emptyState()).ok).toBe(false);
  });

  it("isLocalId tells local ids from cloud ids", () => {
    expect(isLocalId("local-1-abc")).toBe(true);
    expect(isLocalId("6f1c2a3e-0000-4000-8000-000000000000")).toBe(false);
    expect(isLocalId(null)).toBe(false);
  });
});

describe("mp3 export", () => {
  it("only accepts sample rates that support 320 kbps", () => {
    expect(canEncodeMp3(44100)).toBe(true);
    expect(canEncodeMp3(48000)).toBe(true);
    expect(canEncodeMp3(96000)).toBe(false);
    expect(canEncodeMp3(22050)).toBe(false);
  });

  it("converts float to 16-bit with clipping", () => {
    expect(Array.from(floatToInt16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });

  it("encodes a short stereo tone into a valid MP3 stream", async () => {
    const fs = 44100;
    const n = fs; // 1 second
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) l[i] = r[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / fs);
    let last = 0;
    const mp3 = await encodeMp3([l, r], fs, (f) => (last = f));
    expect(last).toBe(1);
    // 320 kbps for 1 s ≈ 40 KB
    expect(mp3.length).toBeGreaterThan(35_000);
    expect(mp3.length).toBeLessThan(45_000);
    // MPEG-1 Layer III frame sync
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1]! & 0xe0).toBe(0xe0);
  });

  it("refuses unsupported sample rates with a clear message", async () => {
    await expect(encodeMp3([new Float32Array(10)], 96000)).rejects.toThrow(/WAV instead/);
  });
});
