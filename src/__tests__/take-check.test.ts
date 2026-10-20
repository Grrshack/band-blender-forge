import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyState } from "@/components/forge/types";
import {
  applyProfile,
  deleteLocalProfile,
  listLocalProfiles,
  parseProfile,
  profileFromBlend,
  saveLocalProfile,
} from "@/lib/sound-profiles";
import { LYRIC_QUICK_SYMPTOMS, QUICK_SYMPTOMS, SYMPTOMS, mergeSymptoms } from "@/lib/symptoms";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const blendWithResult = () => {
  const b = emptyState().blend;
  return {
    ...b,
    artists: ["Portishead", "Nirvana", ""],
    sliders: { energy: 80, complexity: 40, brightness: 30 },
    sunoVersion: "wild" as const,
    targetGenre: "Trip-hop",
    targetEra: "90s",
    result: { styleTag: "trip-hop, grunge guitars", excludeStyles: "edm", vocalPrompt: { voice: "alto" } },
  };
};

describe("sound profiles", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));

  it("captures the prompt and the settings that made it", () => {
    const p = profileFromBlend(blendWithResult())!;
    expect(p.styleTag).toBe("trip-hop, grunge guitars");
    expect(p.artists).toEqual(["Portishead", "Nirvana"]);
    expect(p.sunoVersion).toBe("wild");
  });

  it("has nothing to save without a style prompt", () => {
    expect(profileFromBlend(emptyState().blend)).toBeNull();
  });

  it("round-trips through the browser store and loads back into an empty blend", () => {
    const row = saveLocalProfile("  Dusty trip-hop ", profileFromBlend(blendWithResult())!)!;
    expect(row.title).toBe("Dusty trip-hop");
    expect(listLocalProfiles()).toHaveLength(1);
    const loaded = applyProfile(emptyState().blend, parseProfile(row.body)!);
    expect(loaded.artists).toEqual(["Portishead", "Nirvana", ""]);
    expect(loaded.sliders.energy).toBe(80);
    expect(loaded.targetEra).toBe("90s");
    expect(loaded.result?.excludeStyles).toBe("edm");
    deleteLocalProfile(row.id);
    expect(listLocalProfiles()).toHaveLength(0);
  });

  it("loads older profiles (prompt only) without touching the blend settings", () => {
    const base = blendWithResult();
    const old = parseProfile(JSON.stringify({ v: 1, styleTag: "lofi", excludeStyles: "" }))!;
    const loaded = applyProfile(base, old);
    expect(loaded.result?.styleTag).toBe("lofi");
    expect(loaded.artists).toEqual(base.artists);
    expect(loaded.sliders).toEqual(base.sliders);
  });

  it("rejects damaged profiles", () => {
    expect(parseProfile("not json")).toBeNull();
    expect(parseProfile(JSON.stringify({ v: 2, styleTag: "x", excludeStyles: "" }))).toBeNull();
  });
});

describe("symptoms", () => {
  it("quick picks all exist in Fix a Track's list", () => {
    for (const s of [...QUICK_SYMPTOMS, ...LYRIC_QUICK_SYMPTOMS]) expect(SYMPTOMS).toContain(s);
  });
  it("merges without duplicates", () => {
    expect(mergeSymptoms(["Too slow", "Wrong genre"], ["Wrong genre", "Mix is too busy"])).toEqual([
      "Too slow",
      "Wrong genre",
      "Mix is too busy",
    ]);
  });
});
