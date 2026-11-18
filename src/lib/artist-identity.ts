/**
 * Artist identity: an invented act to put the song out under (name, story, members, look and a
 * tagline), made in one AI call on the person's own key. This file is the pure part: the
 * cleaner the server runs on the AI's answer, the text versions for the song pack and copy, and
 * the colours for the shareable card.
 */
import { findStyleLeaks, scrubArtistNames } from "./suno";

export type IdentityMember = { name: string; role: string };

export type ArtistIdentity = {
  name: string;
  tagline: string;
  story: string;
  members: IdentityMember[];
  look: string;
  /** Two or three #rrggbb colours for the card. */
  palette: string[];
  /** A short genre line for the card, e.g. "Dark synthpop". */
  genre: string;
  /** When it was made (ISO). Set in the browser. */
  at?: string;
};

export type Lineup = "auto" | "solo" | "duo" | "band";

export const LINEUP_LABELS: Record<Lineup, string> = {
  auto: "Let it decide",
  solo: "Solo artist",
  duo: "Duo",
  band: "Band",
};

export const IDENTITY_LIMITS = { name: 40, tagline: 90, story: 480, look: 320, genre: 40, member: 40, members: 5 } as const;

export const DEFAULT_PALETTE = ["#1b1036", "#d6457f", "#f2c14e"];

const HEX = /^#[0-9a-f]{6}$/i;

/** Claims a made-up act can't back up: chart places, awards, stream counts, famous stages. */
const FAKE_CLAIMS =
  /[^.!?]*\b(?:grammy|award[- ]winning|won (?:an?|the) [^.!?]*award|chart[- ]topping|topped the charts?|no\.? ?1 (?:hit|single)|number[- ]one (?:hit|single)|platinum|gold record|million (?:streams|plays|listeners|views)|billboard|sold[- ]out (?:tour|arena|stadium)|headlin(?:ed|ing) (?:coachella|glastonbury|lollapalooza))\b[^.!?]*[.!?]?/gi;

const clip = (v: unknown, max: number): string => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = cut.lastIndexOf(". ");
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "")).trim();
};

/** Removes sentences that claim achievements the act doesn't have. */
export function dropFakeClaims(text: string): string {
  return text.replace(FAKE_CLAIMS, " ").replace(/\s+/g, " ").trim();
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Real names that turn up in the identity. The text is checked for the blend's artists; the act's
 * own name is also checked against `reserved` (well-known names, some of them everyday words like
 * "Ghost", so they're only matched as the whole name).
 */
export function findIdentityLeaks(raw: Record<string, unknown>, names: string[], reserved: string[] = []): string[] {
  const name = String(raw["name"] ?? "");
  const members = Array.isArray(raw["members"]) ? (raw["members"] as Array<Record<string, unknown>>) : [];
  const texts = [
    String(raw["tagline"] ?? ""),
    String(raw["story"] ?? ""),
    String(raw["look"] ?? ""),
    ...members.map((m) => String(m?.["name"] ?? "")),
  ];
  const hits = texts.flatMap((t) => findStyleLeaks(t, names));
  if ([...names, ...reserved].some((n) => sameName(n, name))) hits.push(name);
  return [...new Set(hits)];
}

/**
 * Makes the AI's answer safe to show and save: every field present and within its limit, no
 * real artist names, no invented achievements, members capped, and a valid colour palette.
 */
export function cleanIdentity(
  raw: Record<string, unknown>,
  names: string[],
  lineup: Lineup = "auto",
  reserved: string[] = [],
): ArtistIdentity {
  const scrub = (s: string) => (names.length ? scrubArtistNames(s, names).text : s);
  let name = clip(raw["name"], IDENTITY_LIMITS.name).replace(/^["']|["']$/g, "");
  if (!name || [...names, ...reserved].some((n) => sameName(n, name))) name = "Untitled Project";

  const rawMembers = Array.isArray(raw["members"]) ? (raw["members"] as unknown[]) : [];
  const max = lineup === "solo" ? 1 : lineup === "duo" ? 2 : IDENTITY_LIMITS.members;
  const members = rawMembers
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((m) => ({ name: scrub(clip(m["name"], IDENTITY_LIMITS.member)), role: clip(m["role"], IDENTITY_LIMITS.member) }))
    .filter((m) => m.name && ![...names, ...reserved].some((n) => sameName(n, m.name)))
    .slice(0, max);

  const palette = (Array.isArray(raw["palette"]) ? (raw["palette"] as unknown[]) : [])
    .filter((c): c is string => typeof c === "string" && HEX.test(c.trim()))
    .map((c) => c.trim().toLowerCase())
    .slice(0, 3);

  return {
    name,
    tagline: scrub(dropFakeClaims(clip(raw["tagline"], IDENTITY_LIMITS.tagline))),
    story: scrub(dropFakeClaims(clip(raw["story"], IDENTITY_LIMITS.story))),
    members,
    look: scrub(clip(raw["look"], IDENTITY_LIMITS.look)),
    palette: palette.length >= 2 ? palette : DEFAULT_PALETTE,
    genre: scrub(clip(raw["genre"], IDENTITY_LIMITS.genre)),
  };
}

/** Reads a saved identity back, or null when the save doesn't hold a usable one. */
export function readIdentity(v: unknown): ArtistIdentity | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r["name"] !== "string" || !r["name"].trim()) return null;
  const out = cleanIdentity(r, []);
  return typeof r["at"] === "string" ? { ...out, at: r["at"] } : out;
}

/** Plain text: for Copy, and the start of the song pack's identity file. */
export function identityText(id: ArtistIdentity): string {
  return [
    id.name,
    id.tagline,
    id.genre ? `Genre: ${id.genre}` : "",
    "",
    id.story,
    "",
    id.members.length ? `Lineup\n${id.members.map((m) => `- ${m.name}${m.role ? `: ${m.role}` : ""}`).join("\n")}` : "",
    id.look ? `\nLook\n${id.look}` : "",
  ]
    .filter((l, i, all) => l !== "" || (all[i - 1] ?? "") !== "")
    .join("\n")
    .trim();
}

/** Markdown for the song pack (release/artist-identity.md). */
export function identityMarkdown(id: ArtistIdentity): string {
  return [
    `# ${id.name}`,
    id.tagline ? `*${id.tagline}*` : "",
    id.genre ? `**Genre:** ${id.genre}` : "",
    "## Story",
    id.story,
    id.members.length ? "## Lineup" : "",
    id.members.map((m) => `- **${m.name}**${m.role ? `: ${m.role}` : ""}`).join("\n"),
    id.look ? "## Look" : "",
    id.look,
    "---",
    "An invented act for this release. Don't claim real achievements for it, and say it's AI-made where a distributor asks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Relative luminance (0–1), to pick readable text on the card. */
export function luminance(hex: string): number {
  const m = HEX.test(hex) ? hex.slice(1) : "000000";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The card's background and text colours: dark backgrounds get light text and the reverse. */
export function cardColors(palette: string[]): { from: string; to: string; accent: string; text: string; muted: string } {
  const p = palette.length >= 2 ? palette : DEFAULT_PALETTE;
  // Darkest colour goes behind the text so it stays readable.
  const sorted = [...p].sort((a, b) => luminance(a) - luminance(b));
  const from = sorted[0]!;
  const to = sorted[1]!;
  const accent = sorted[sorted.length - 1]!;
  const dark = (luminance(from) + luminance(to)) / 2 < 0.35;
  return { from, to, accent, text: dark ? "#ffffff" : "#111111", muted: dark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.68)" };
}
