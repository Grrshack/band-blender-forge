import { describe, expect, it } from "vitest";

import starters from "../../supabase/seed/community-starters.json";
import { preflight } from "@/lib/preflight";
import { ALL_GENRES, SUNO_LIMITS } from "@/lib/suno";

type Starter = { title: string; genre: string; style: string; exclude: string; vocal: Record<string, string> | null; note: string };
const list = starters as Starter[];

describe("community starter prompts", () => {
  it("covers every genre group with 40+ unique titles", () => {
    expect(list.length).toBeGreaterThanOrEqual(40);
    expect(new Set(list.map((s) => s.title)).size).toBe(list.length);
  });

  it("uses the app's genre names so the genre filter finds them", () => {
    for (const s of list) expect(ALL_GENRES, s.title).toContain(s.genre);
  });

  it("fits Suno's boxes and the database limits", () => {
    for (const s of list) {
      expect(s.title.length, s.title).toBeGreaterThanOrEqual(3);
      expect(s.title.length, s.title).toBeLessThanOrEqual(80);
      expect(s.style.length, s.title).toBeLessThanOrEqual(SUNO_LIMITS.style);
      expect(s.exclude.length, s.title).toBeLessThanOrEqual(SUNO_LIMITS.exclude);
      expect(s.note.length, s.title).toBeLessThanOrEqual(300);
    }
  });

  it("passes pre-flight with nothing blocking, and no style/exclude clash", () => {
    for (const s of list) {
      const issues = preflight({ style: s.style, exclude: s.exclude, version: "v6", artistNames: [] });
      expect(issues.filter((i) => i.level === "stop"), s.title).toEqual([]);
      // Starters should model good practice: no unplaced soft vocals, no negatives in the style box.
      expect(issues.map((i) => i.message).filter((m) => /Soft or intimate|negative inside/.test(m)), s.title).toEqual([]);
    }
  });
});
