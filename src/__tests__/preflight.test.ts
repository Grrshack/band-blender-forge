import { describe, expect, it } from "vitest";

import { preflight } from "@/lib/preflight";

const run = (style: string, exclude = "", artistNames: string[] = []) =>
  preflight({ style, exclude, version: "v6", artistNames });

describe("preflight", () => {
  it("passes a clean prompt", () => {
    expect(run("trip-hop, dark art-pop, 80 bpm, sub bass, smoky alto, melancholic")).toEqual([]);
  });

  it("stops on an empty prompt, artist names and style/exclude overlap", () => {
    expect(run("")[0]!.level).toBe("stop");
    expect(run("grunge, sounds like Nirvana", "", ["Nirvana"]).some((i) => i.level === "stop")).toBe(true);
    expect(run("rock, distorted guitars", "distorted guitars").some((i) => i.message.includes("both"))).toBe(true);
  });

  it("warns on contradictions, two tempos, negatives and a late genre", () => {
    const msgs = run("calm, aggressive, 90 bpm, 140 bpm, no drums, bright, airy, rock").map((i) => i.message);
    expect(msgs.some((m) => m.includes("calm and aggressive"))).toBe(true);
    expect(msgs.some((m) => m.includes("More than one tempo"))).toBe(true);
    expect(msgs.some((m) => m.includes("Exclude styles"))).toBe(true);
    expect(msgs.some((m) => m.includes("genre comes late"))).toBe(true);
  });

  it("allows a duet", () => {
    expect(run("pop, male vocal, female vocal, duet")).toEqual([]);
    expect(run("pop, male vocal, female vocal").length).toBe(1);
  });
});
