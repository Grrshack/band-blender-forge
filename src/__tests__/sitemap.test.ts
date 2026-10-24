import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_DOMAIN } from "@/lib/brand";
import { GUIDES } from "@/lib/guides";
import { buildSitemap } from "@/lib/sitemap";

const file = resolve(__dirname, "../../public/sitemap.xml");
const manifest = resolve(__dirname, "../../public/manifest.webmanifest");

describe("sitemap", () => {
  it("public/sitemap.xml is up to date (UPDATE_SITEMAP=1 to regenerate)", () => {
    const want = buildSitemap(APP_DOMAIN);
    if (process.env["UPDATE_SITEMAP"]) writeFileSync(file, want);
    expect(readFileSync(file, "utf8")).toBe(want);
  });
  it("lists every guide and the free tools", () => {
    const xml = buildSitemap(APP_DOMAIN);
    for (const g of GUIDES) expect(xml).toContain(`/guides/${g.slug}</loc>`);
    expect(xml).toContain("/tools/bpm-key-finder</loc>");
    expect(xml).not.toContain("/admin");
  });
});

describe("installable app", () => {
  it("has a manifest with the icons phones need", () => {
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    expect(m.name).toBe("Band Blender");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/studio");
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const i of m.icons) expect(existsSync(resolve(__dirname, "../../public", i.src.replace(/^\//, "")))).toBe(true);
  });
});
