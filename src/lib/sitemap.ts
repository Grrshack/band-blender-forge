/**
 * Builds public/sitemap.xml: every public page search engines should know about. The
 * sitemap test fails if a guide or tool is added without regenerating the file
 * (run: UPDATE_SITEMAP=1 npx vitest run sitemap).
 */
import { GUIDES } from "./guides";

export const PUBLIC_PATHS = [
  "/",
  "/studio",
  "/tools",
  "/tools/bpm-key-finder",
  "/tools/lyric-checker",
  "/tools/suno-metatags",
  "/tools/release-checklist",
  "/guides",
];

export function buildSitemap(domain: string): string {
  const paths = [...PUBLIC_PATHS, ...GUIDES.map((g) => `/guides/${g.slug}`)];
  const urls = paths.map((p) => `  <url><loc>https://${domain}${p === "/" ? "/" : p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
