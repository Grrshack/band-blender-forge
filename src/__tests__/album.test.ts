import { describe, expect, it } from "vitest";

import { albumTips, moveTrack, newAlbum, newTrack, parseLength, releaseType, runtime, trackStyle } from "@/lib/album";

const tracks = (n: number, seconds = 180) => Array.from({ length: n }, (_, i) => newTrack(`T${i + 1}`, { seconds }));

describe("release type", () => {
  it("counts like the stores do", () => {
    expect(releaseType([])).toBe("empty");
    expect(releaseType(tracks(2))).toBe("single");
    expect(releaseType(tracks(5))).toBe("EP");
    expect(releaseType(tracks(7))).toBe("album");
    expect(releaseType(tracks(5, 400))).toBe("album"); // over 30 minutes
  });
});

describe("album helpers", () => {
  it("sums the running time and counts unknown lengths", () => {
    expect(runtime([newTrack("a", { seconds: 200 }), newTrack("b")])).toEqual({ seconds: 200, unknown: 1 });
  });
  it("parses lengths", () => {
    expect(parseLength("3:45")).toBe(225);
    expect(parseLength("200")).toBe(200);
    expect(parseLength("abc")).toBeUndefined();
  });
  it("moves tracks", () => {
    const t = tracks(3);
    expect(moveTrack(t, 2, 0).map((x) => x.title)).toEqual(["T3", "T1", "T2"]);
    expect(moveTrack(t, 0, -1)).toBe(t);
  });
  it("builds a track's style from the shared sound and its twist", () => {
    const a = newAlbum("Night Shift", "Joe", "dream pop, 92 bpm, airy female vocal,");
    expect(trackStyle(a, newTrack("x", { twist: "slower, acoustic guitar" }))).toBe(
      "dream pop, 92 bpm, airy female vocal, slower, acoustic guitar",
    );
  });
  it("gives sequencing tips", () => {
    const a = newAlbum("EP", "", "");
    a.tracks = tracks(5);
    a.tracks[4]!.single = true;
    const tips = albumTips(a).join(" ");
    expect(tips).toMatch(/shared sound/);
    expect(tips).toMatch(/first three/);
  });
});
