import { describe, expect, it } from "vitest";

import { GENRE_CARDS, USE_CASE_CARDS } from "./genre-cards";
import { GENRE_PAGES, genrePageBySlug, startersFor } from "./genre-pages";
import { buildStudioHref } from "./handoff";
import { KNOWN_ARTISTS, checkPrompt } from "./prompt-checker";
import { buildSitemap } from "./sitemap";

const allPrompts = GENRE_PAGES.flatMap((p) => [
  { page: p.slug, title: "starter", ...p.prompt },
  ...p.starters.map((s) => ({ page: p.slug, title: s.title, style: s.style, exclude: s.exclude })),
]);

describe("genre pages", () => {
  it("has one page per genre card and use-case card, with unique slugs", () => {
    expect(GENRE_PAGES).toHaveLength(GENRE_CARDS.length + USE_CASE_CARDS.length);
    expect(new Set(GENRE_PAGES.map((p) => p.slug)).size).toBe(GENRE_PAGES.length);
    for (const p of GENRE_PAGES) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives every page a search-friendly title and description", () => {
    for (const p of GENRE_PAGES) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(70);
      expect(p.description.length, p.slug).toBeGreaterThan(50);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
      expect(p.title).toMatch(/Suno/);
    }
  });

  it("finds pages by slug and nothing for an unknown one", () => {
    expect(genrePageBySlug("hip-hop")?.name).toMatch(/Hip/);
    expect(genrePageBySlug("nope")).toBeUndefined();
  });

  it("links only to pages that exist, never to itself", () => {
    for (const p of GENRE_PAGES) {
      expect(p.related.length).toBeGreaterThan(0);
      for (const r of p.related) {
        expect(genrePageBySlug(r.slug), `${p.slug} → ${r.slug}`).toBeDefined();
        expect(r.slug).not.toBe(p.slug);
      }
    }
  });

  it("shows up to four starters, and every genre page has at least one", () => {
    for (const p of GENRE_PAGES) expect(p.starters.length).toBeLessThanOrEqual(4);
    for (const p of GENRE_PAGES.filter((g) => g.kind === "genre")) expect(startersFor(p.slug).length, p.slug).toBeGreaterThan(0);
  });

  it("only shows prompts that pass our own checker with no warnings", () => {
    for (const s of allPrompts) {
      const r = checkPrompt({ title: "", style: s.style, exclude: s.exclude, lyrics: "", artists: [], version: "v6" });
      const bad = r.issues.filter((i) => i.level !== "tip").map((i) => i.message);
      expect(bad, `${s.page}: ${s.title}`).toEqual([]);
      expect(r.score ?? 0).toBeGreaterThanOrEqual(85);
    }
  });

  it("never puts an artist name in a prompt", () => {
    const names = KNOWN_ARTISTS.map((n) => n.toLowerCase());
    for (const s of allPrompts) {
      const text = `${s.style} ${s.exclude}`.toLowerCase();
      for (const n of names) expect(text.includes(n) && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text), `${s.page}: ${n}`).toBe(false);
    }
  });

  it("hands off to Quick song and to the artist blender", () => {
    for (const p of GENRE_PAGES) {
      expect(buildStudioHref({ kind: "describe", text: p.describe })).toMatch(/^\/studio\?/);
      for (const b of p.blends) expect(buildStudioHref({ kind: "artists", artists: b.artists })).toMatch(/^\/studio\?/);
    }
  });

  it("is in the sitemap", () => {
    const xml = buildSitemap("example.com");
    expect(xml).toContain("<loc>https://example.com/genres</loc>");
    for (const p of GENRE_PAGES) expect(xml).toContain(`https://example.com/genres/${p.slug}</loc>`);
  });
});
