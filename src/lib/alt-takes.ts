/**
 * Alternate takes: the same song's style pushed in a direction (darker, heavier, a bigger
 * drop…), kept side by side as tabs. Whichever take is active fills the result's normal style
 * fields, so every tool (pre-flight, Suno Sheet, Send to Suno, song pack) keeps working
 * unchanged. Switching saves the current fields back into their tab first, so edits are kept.
 */
import { arrangeFormats, type BriefParts, type PromptFormat } from "@/lib/prompt-craft";
import type { BlendResult } from "@/components/forge/types";

export type AltTake = {
  id: string;
  label: string;
  /** One sentence on what changed (alternates only). */
  angle?: string | undefined;
  styleTag: string;
  styleAlt?: string | undefined;
  styleFormat?: PromptFormat | undefined;
  briefParts?: BriefParts | undefined;
  excludeStyles: string;
};

export type TakeDirection = { id: string; label: string; ask: string };

/** The quick picks. "ask" is what the AI is told to change. */
export const TAKE_DIRECTIONS: TakeDirection[] = [
  { id: "darker", label: "Darker", ask: "darker: minor-leaning harmony, moodier and more shadowy textures, a heavier emotional weight" },
  { id: "heavier", label: "Heavier", ask: "heavier: more distortion and weight in the guitars or synths, harder-hitting drums, a thicker low end" },
  { id: "drop", label: "Bigger drop", ask: "a bigger drop: a stronger build and a hard-hitting drop or beat switch into the chorus, more contrast between quiet and loud" },
  { id: "softer", label: "Softer", ask: "softer: gentler dynamics, lighter drums or none, warmer and more intimate" },
  { id: "faster", label: "Faster", ask: "faster: a noticeably higher tempo and more driving rhythm" },
  { id: "stripped", label: "Stripped back", ask: "stripped back: fewer instruments, more space, the voice and one or two instruments carry it" },
  { id: "brighter", label: "Brighter", ask: "brighter: major-leaning, uplifting, sparkling top end and more energy" },
];
export const DEFAULT_DIRECTIONS = ["darker", "drop"];
export const MAX_DIRECTIONS = 3;

/** Turns picked ids and a custom phrase into what the AI is asked for. */
export function directionsFor(ids: string[], custom: string): Array<{ label: string; ask: string }> {
  const picked = TAKE_DIRECTIONS.filter((d) => ids.includes(d.id)).map((d) => ({ label: d.label, ask: d.ask }));
  const own = custom.trim().slice(0, 60);
  if (own) picked.push({ label: own.charAt(0).toUpperCase() + own.slice(1, 30), ask: own });
  return picked.slice(0, MAX_DIRECTIONS);
}

const MAIN = "main";

/** The result's current style fields as a take. */
function current(r: BlendResult, id: string, label: string, angle?: string): AltTake {
  return {
    id,
    label,
    ...(angle ? { angle } : {}),
    styleTag: r.styleTag ?? "",
    ...(r.styleAlt ? { styleAlt: r.styleAlt } : {}),
    ...(r.styleFormat ? { styleFormat: r.styleFormat } : {}),
    ...(r.briefParts ? { briefParts: r.briefParts } : {}),
    excludeStyles: r.excludeStyles ?? "",
  };
}

export const takesOf = (r: BlendResult | null | undefined): AltTake[] => r?.altTakes ?? [];
export const activeTakeId = (r: BlendResult | null | undefined): string => r?.activeTake ?? MAIN;

/** Saves the active take's fields (with any edits) back into its tab. */
function saveActive(r: BlendResult): AltTake[] {
  const takes = takesOf(r);
  const id = activeTakeId(r);
  const prev = takes.find((t) => t.id === id);
  const snap = current(r, id, prev?.label ?? "Main", prev?.angle);
  return takes.length ? takes.map((t) => (t.id === id ? snap : t)) : [snap];
}

/** One alternate as the AI returned it (after the server cleaned it). */
export type RawAlternate = {
  label?: string;
  angle?: string;
  styleTag?: string;
  styleBrief?: string;
  styleBriefParts?: unknown;
  excludeStyles?: string;
};

/** Builds a take from the AI's answer, in the song's preferred format (both versions kept). */
export function takeFromAlternate(a: RawAlternate, format: PromptFormat, n: number): AltTake | null {
  const input: BlendResult = { styleTag: a.styleTag ?? "", styleBrief: a.styleBrief, styleBriefParts: a.styleBriefParts };
  const r: BlendResult = arrangeFormats(input, format);
  if (!(r.styleTag ?? "").trim()) return null;
  const label = (a.label ?? "").trim().slice(0, 30) || `Take ${n}`;
  return {
    id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}${n}`,
    label,
    ...(a.angle ? { angle: a.angle.slice(0, 200) } : {}),
    styleTag: r.styleTag ?? "",
    ...(r.styleAlt ? { styleAlt: r.styleAlt } : {}),
    ...(r.styleFormat ? { styleFormat: r.styleFormat } : {}),
    ...(r.briefParts ? { briefParts: r.briefParts } : {}),
    excludeStyles: (a.excludeStyles ?? "").trim(),
  };
}

/** Adds alternates as new tabs (a tab with the same name is replaced). The active tab stays. */
export function withAlternates(r: BlendResult, alts: AltTake[]): BlendResult {
  const takes = saveActive(r);
  const names = new Set(alts.map((a) => a.label.toLowerCase()));
  const kept = takes.filter((t) => t.id === activeTakeId(r) || t.id === MAIN || !names.has(t.label.toLowerCase()));
  return { ...r, altTakes: [...kept, ...alts].slice(0, 7), activeTake: activeTakeId(r) };
}

/** Shows another tab: the current one is saved first, then the chosen one fills the style fields. */
export function switchTake(r: BlendResult, id: string): BlendResult {
  if (id === activeTakeId(r)) return r;
  const takes = saveActive(r);
  const next = takes.find((t) => t.id === id);
  if (!next) return r;
  return {
    ...r,
    altTakes: takes,
    activeTake: id,
    styleTag: next.styleTag,
    styleAlt: next.styleAlt,
    styleFormat: next.styleFormat,
    briefParts: next.briefParts,
    excludeStyles: next.excludeStyles,
  };
}

/** Removes an alternate tab (never Main). Removing the open one switches back to Main first. */
export function removeTake(r: BlendResult, id: string): BlendResult {
  if (id === MAIN) return r;
  const base = activeTakeId(r) === id ? switchTake(r, MAIN) : r;
  const takes = takesOf(base).filter((t) => t.id !== id);
  return { ...base, altTakes: takes.length > 1 ? takes : undefined, activeTake: takes.length > 1 ? activeTakeId(base) : undefined };
}

/** Every take with up-to-date text (the active one read live), for Send to Suno and the song pack. */
export function allTakes(r: BlendResult | null | undefined): { takes: AltTake[]; active: number } {
  if (!r || takesOf(r).length < 2) return { takes: [], active: 0 };
  const takes = saveActive(r);
  return { takes, active: Math.max(0, takes.findIndex((t) => t.id === activeTakeId(r))) };
}

/** The open take's name when it isn't Main (for the Take Log), else undefined. */
export function activeTakeLabel(r: BlendResult | null | undefined): string | undefined {
  if (!r || takesOf(r).length < 2 || activeTakeId(r) === MAIN) return undefined;
  return takesOf(r).find((t) => t.id === activeTakeId(r))?.label;
}
