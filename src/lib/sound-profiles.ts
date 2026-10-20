/**
 * Sound profiles: a named, reusable sound (style prompt, exclusions, vocal line, and the
 * blend settings that made it). Signed-in users keep them in their account; everyone else
 * keeps them in this browser. Pure apart from localStorage, so it's unit tested.
 */
import type { BlendResult, BlendSlice } from "@/components/forge/types";
import { normalizeSunoVersion } from "@/lib/suno";

export type ProfileBody = {
  v: 1;
  styleTag: string;
  excludeStyles: string;
  vocalPrompt?: BlendResult["vocalPrompt"];
  /** Added later; older profiles don't have these and load the prompt only. */
  artists?: string[];
  sliders?: BlendSlice["sliders"];
  sunoVersion?: BlendSlice["sunoVersion"];
  targetGenre?: string;
  targetEra?: string;
};

export type ProfileRow = { id: string; title: string; body: string };

export function profileFromBlend(blend: BlendSlice): ProfileBody | null {
  const r = blend.result;
  if (!r?.styleTag?.trim()) return null;
  return {
    v: 1,
    styleTag: r.styleTag,
    excludeStyles: r.excludeStyles ?? "",
    ...(r.vocalPrompt ? { vocalPrompt: r.vocalPrompt } : {}),
    artists: blend.artists.filter((a) => a.trim()),
    sliders: blend.sliders,
    sunoVersion: blend.sunoVersion,
    targetGenre: blend.targetGenre,
    targetEra: blend.targetEra,
  };
}

export function parseProfile(body: string): ProfileBody | null {
  try {
    const p = JSON.parse(body) as Partial<ProfileBody>;
    if (p.v !== 1 || typeof p.styleTag !== "string" || typeof p.excludeStyles !== "string") return null;
    return p as ProfileBody;
  } catch {
    return null;
  }
}

/** Applies a profile to the blend. Settings a profile doesn't have are left as they are. */
export function applyProfile(blend: BlendSlice, p: ProfileBody): BlendSlice {
  const s = p.sliders;
  const validSliders =
    s && [s.energy, s.complexity, s.brightness].every((n) => typeof n === "number" && n >= 0 && n <= 100);
  return {
    ...blend,
    ...(p.artists?.length
      ? { lookupMode: "band" as const, artists: [...p.artists, "", "", ""].slice(0, 3) }
      : {}),
    ...(validSliders ? { sliders: s } : {}),
    ...(p.sunoVersion ? { sunoVersion: normalizeSunoVersion(p.sunoVersion) } : {}),
    ...(typeof p.targetGenre === "string" ? { targetGenre: p.targetGenre } : {}),
    ...(typeof p.targetEra === "string" ? { targetEra: p.targetEra } : {}),
    result: {
      ...(blend.result ?? {}),
      styleTag: p.styleTag,
      excludeStyles: p.excludeStyles,
      ...(p.vocalPrompt ? { vocalPrompt: p.vocalPrompt } : {}),
    },
  };
}

/* ---------- in-browser store for people who aren't signed in ---------- */

const KEY = "blf.sound-profiles";
export const MAX_LOCAL_PROFILES = 50;

export function listLocalProfiles(): ProfileRow[] {
  try {
    const arr: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r): r is ProfileRow =>
        !!r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string" && typeof r.body === "string",
    );
  } catch {
    return [];
  }
}

function writeLocal(rows: ProfileRow[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX_LOCAL_PROFILES)));
    return true;
  } catch {
    return false;
  }
}

/** Saves a profile in this browser. Returns null if the browser refused (storage full). */
export function saveLocalProfile(title: string, body: ProfileBody): ProfileRow | null {
  const row: ProfileRow = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 120) || "My sound",
    body: JSON.stringify(body),
  };
  return writeLocal([...listLocalProfiles(), row]) ? row : null;
}

export function deleteLocalProfile(id: string): void {
  writeLocal(listLocalProfiles().filter((r) => r.id !== id));
}
