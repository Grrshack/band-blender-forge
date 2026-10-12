import { describe, it, expect } from "vitest";
import { emptyState, hasContent, mergeState, exportBrief, type ForgeState } from "@/components/forge/types";

// ── emptyState ────────────────────────────────────────────────────────────────

describe("emptyState", () => {
  it("returns a new object on each call (not a shared reference)", () => {
    const a = emptyState();
    const b = emptyState();
    expect(a).not.toBe(b);
    expect(a.blend).not.toBe(b.blend);
  });

  it("has three empty artist slots", () => {
    expect(emptyState().blend.artists).toEqual(["", "", ""]);
  });

  it("has default sliders at expected values", () => {
    expect(emptyState().blend.sliders).toEqual({ energy: 60, complexity: 50, brightness: 55 });
  });

  it("has no blend result", () => {
    expect(emptyState().blend.result).toBeNull();
  });

  it("has no lyrics sections", () => {
    expect(emptyState().lyrics.sections).toEqual([]);
  });

  it("has empty takes list", () => {
    expect(emptyState().takes).toEqual([]);
  });

  it("has null dossier", () => {
    expect(emptyState().dossier).toBeNull();
  });
});

// ── hasContent ────────────────────────────────────────────────────────────────

describe("hasContent", () => {
  it("returns false for an empty state", () => {
    expect(hasContent(emptyState())).toBe(false);
  });

  it("returns true when an artist name is filled in", () => {
    const s = emptyState();
    s.blend.artists[0] = "Radiohead";
    expect(hasContent(s)).toBe(true);
  });

  it("returns false for artists that are all whitespace", () => {
    const s = emptyState();
    s.blend.artists = ["   ", "\t", ""];
    expect(hasContent(s)).toBe(false);
  });

  it("returns true when blend result is present", () => {
    const s = emptyState();
    s.blend.result = { genre: "rock" };
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when lyrics theme is set", () => {
    const s = emptyState();
    s.lyrics.theme = "loss and redemption";
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when there are lyric sections", () => {
    const s = emptyState();
    s.lyrics.sections = [{ tag: "[Verse]", lines: [{ text: "Hello", locked: false }] }];
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when compare result is present", () => {
    const s = emptyState();
    s.compare.result = { summary: "similar vibe" };
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when there is a fix result", () => {
    const s = emptyState();
    s.fix.result = { diagnosis: "too much reverb" };
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when takes is non-empty", () => {
    const s = emptyState();
    s.takes = [{ id: "1", at: "2024-01-01T00:00:00Z", style: "pop", exclude: "", rating: 4, note: "" }];
    expect(hasContent(s)).toBe(true);
  });

  it("returns true when dossier is present", () => {
    const s = emptyState();
    s.dossier = { titleOptions: ["Neon Dreams"] };
    expect(hasContent(s)).toBe(true);
  });
});

// ── mergeState ────────────────────────────────────────────────────────────────

describe("mergeState", () => {
  it("returns emptyState for null", () => {
    expect(mergeState(null)).toEqual(emptyState());
  });

  it("returns emptyState for a string", () => {
    expect(mergeState("not an object")).toEqual(emptyState());
  });

  it("returns emptyState for undefined", () => {
    expect(mergeState(undefined)).toEqual(emptyState());
  });

  it("returns emptyState for an empty object", () => {
    expect(mergeState({})).toEqual(emptyState());
  });

  it("merges partial blend data onto the defaults", () => {
    const result = mergeState({ blend: { artists: ["Daft Punk", "Justice", ""] } });
    expect(result.blend.artists).toEqual(["Daft Punk", "Justice", ""]);
    // defaults should still be present
    expect(result.blend.sliders).toEqual(emptyState().blend.sliders);
  });

  it("preserves non-array takes from raw data", () => {
    const result = mergeState({ takes: [] });
    expect(result.takes).toEqual([]);
  });

  it("falls back to empty takes when takes is not an array", () => {
    const result = mergeState({ takes: "not-an-array" as unknown });
    expect(result.takes).toEqual([]);
  });

  it("merges lyrics data while keeping defaults", () => {
    const result = mergeState({ lyrics: { title: "My Song" } });
    expect(result.lyrics.title).toBe("My Song");
    expect(result.lyrics.theme).toBe(""); // default
  });

  it("sets dossier to null when it is a non-object", () => {
    const result = mergeState({ dossier: "bad" as unknown });
    expect(result.dossier).toBeNull();
  });

  it("preserves a valid dossier object", () => {
    const dossier = { titleOptions: ["Track A", "Track B"] };
    const result = mergeState({ dossier });
    expect(result.dossier).toEqual(dossier);
  });
});

// ── exportBrief ───────────────────────────────────────────────────────────────

describe("exportBrief", () => {
  it("includes the document name as an h1", () => {
    const brief = exportBrief("My Session", emptyState());
    expect(brief).toMatch(/^# My Session/);
  });

  it("returns just the heading for an empty state", () => {
    const brief = exportBrief("Empty", emptyState());
    expect(brief.trim()).toBe("# Empty");
  });

  it("includes artist names when filled in", () => {
    const s = emptyState();
    s.blend.artists = ["Radiohead", "Portishead", ""];
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Radiohead + Portishead");
  });

  it("omits the blend section when all artist slots are empty", () => {
    const brief = exportBrief("Session", emptyState());
    expect(brief).not.toContain("Blend");
  });

  it("includes blend result fields when present", () => {
    const s = emptyState();
    s.blend.artists = ["Radiohead"];
    s.blend.result = {
      genre: "art rock",
      tempo: "medium",
      instrumentation: "guitar, bass, drums",
      vocals: "melancholic, falsetto",
      mood: "pensive",
      styleTag: "art rock, radiohead-esque",
      excludeStyles: "pop, country",
      reconciliation: "coherent blend",
    };
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Genre: art rock");
    expect(brief).toContain("Style tag: art rock, radiohead-esque");
    expect(brief).toContain("Exclude styles: pop, country");
    expect(brief).toContain("Reconciliation: coherent blend");
  });

  it("includes lyrics section when sections are present", () => {
    const s = emptyState();
    s.lyrics.title = "Fade Out";
    s.lyrics.sections = [
      { tag: "[Verse]", lines: [{ text: "In the quiet morning light", locked: false }] },
    ];
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Lyrics — Fade Out");
    expect(brief).toContain("In the quiet morning light");
  });

  it("labels lyrics as Untitled when no title set", () => {
    const s = emptyState();
    s.lyrics.sections = [{ tag: "[Verse]", lines: [{ text: "Line", locked: false }] }];
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Lyrics — Untitled");
  });

  it("includes comparable artists when present", () => {
    const s = emptyState();
    s.compare.result = {
      artists: [
        { name: "Sigur Rós", match: 82, reasoning: ["expansive sound", "ethereal vocals"] },
      ],
    };
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Comparable artists");
    expect(brief).toContain("Sigur Rós (82%)");
    expect(brief).toContain("- expansive sound");
  });

  it("includes honest feedback when present", () => {
    const s = emptyState();
    s.critique.result = {
      verdict: "Strong hook, weak bridge.",
      scores: [{ label: "Hook", score: 8, note: "catchy" }],
      fixFirst: ["Rewrite bridge"],
    };
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Honest feedback");
    expect(brief).toContain("Strong hook, weak bridge.");
    expect(brief).toContain("Hook: 8/10 — catchy");
    expect(brief).toContain("1. Rewrite bridge");
  });

  it("includes fix diagnosis when present", () => {
    const s = emptyState();
    s.fix.result = { diagnosis: "Too much compression.", tryNext: "Raise threshold" };
    const brief = exportBrief("Session", s);
    expect(brief).toContain("Last take diagnosis");
    expect(brief).toContain("Too much compression.");
    expect(brief).toContain("Try next: Raise threshold");
  });
});
