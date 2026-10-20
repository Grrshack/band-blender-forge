/**
 * The landing page (/) hands what the visitor typed to the studio (/studio) through
 * the URL, so nothing is stored and the studio picks it up on load.
 */
import { normalizeSunoVersion, type SunoVersion } from "@/lib/suno";

export type Handoff =
  | { kind: "describe"; text: string }
  | { kind: "artists"; artists: string[] }
  | { kind: "song"; song: string };

export type HandoffInput = Handoff & {
  sliders?: { energy: number; complexity: number; brightness: number } | undefined;
  sunoVersion?: SunoVersion | undefined;
};

const MAX_TEXT = 500;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);

/** Returns a /studio link, or null when the visitor hasn't typed anything usable. */
export function buildStudioHref(input: HandoffInput): string | null {
  const q = new URLSearchParams();
  if (input.kind === "describe") {
    const t = clean(input.text);
    if (!t) return null;
    q.set("describe", t);
  } else if (input.kind === "artists") {
    const a = input.artists.map(clean).filter(Boolean).slice(0, 3);
    if (!a.length) return null;
    a.forEach((name) => q.append("artist", name));
  } else {
    const s = clean(input.song);
    if (!s) return null;
    q.set("song", s);
  }
  if (input.sliders) {
    q.set("e", String(clamp(input.sliders.energy)));
    q.set("c", String(clamp(input.sliders.complexity)));
    q.set("b", String(clamp(input.sliders.brightness)));
  }
  if (input.sunoVersion) q.set("v", input.sunoVersion);
  return `/studio?${q.toString()}`;
}

export type ParsedHandoff = {
  handoff: Handoff;
  sliders: { energy: number; complexity: number; brightness: number } | null;
  sunoVersion: SunoVersion | null;
};

/** Reads a handoff from a /studio query string. Returns null for ordinary visits. */
export function readHandoff(search: string): ParsedHandoff | null {
  const q = new URLSearchParams(search);
  let handoff: Handoff | null = null;
  const describe = clean(q.get("describe") ?? "");
  const artists = q.getAll("artist").map(clean).filter(Boolean).slice(0, 3);
  const song = clean(q.get("song") ?? "");
  if (describe) handoff = { kind: "describe", text: describe };
  else if (artists.length) handoff = { kind: "artists", artists };
  else if (song) handoff = { kind: "song", song };
  if (!handoff) return null;

  const num = (k: string) => {
    const raw = q.get(k);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n) : null;
  };
  const e = num("e");
  const c = num("c");
  const b = num("b");
  const v = q.get("v");
  return {
    handoff,
    sliders: e !== null && c !== null && b !== null ? { energy: e, complexity: c, brightness: b } : null,
    sunoVersion: v ? normalizeSunoVersion(v) : null,
  };
}

/** Query keys the studio removes from the address bar after reading a handoff. */
export const HANDOFF_KEYS = ["describe", "artist", "song", "e", "c", "b", "v"] as const;

/**
 * Old links pointed at "/" (?tab=, ?remix=, #share=), and sign-up confirmation emails
 * return to the site root with the session in the address. The landing page now lives
 * at "/", so those visits are forwarded to the studio with everything after the path kept.
 */
export function legacyStudioRedirect(search: string, hash: string): string | null {
  const q = new URLSearchParams(search);
  const isLegacy =
    q.has("tab") ||
    q.has("remix") ||
    q.has("code") ||
    /(^|[#&])(share|access_token|error_description)=/.test(hash);
  return isLegacy ? `/studio${search}${hash}` : null;
}
