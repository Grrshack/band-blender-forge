/**
 * Suno download budget, tracked from the person's own "Downloaded" ticks in the Take Log.
 * Nothing is read from Suno: the count only knows what was ticked here, across every song in
 * this browser. Plan limits (Sept 2026): Free 7 ever, Pro 20 a month, Premier 60 a month.
 */
import { splitTags, type Take } from "./takes";

export type SunoPlan = "free" | "pro" | "premier";

export const PLAN_LIMITS: Record<SunoPlan, { label: string; limit: number; monthly: boolean }> = {
  free: { label: "Free", limit: 7, monthly: false },
  pro: { label: "Pro", limit: 20, monthly: true },
  premier: { label: "Premier", limit: 60, monthly: true },
};

export type DownloadEvent = { takeId: string; at: string; title: string };
export type BudgetSettings = { plan: SunoPlan; resetDay: number };

const EVENTS_KEY = "bb.downloads";
const SETTINGS_KEY = "bb.downloadPlan";

export function loadEvents(): DownloadEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.takeId === "string" && typeof e.at === "string") : [];
  } catch {
    return [];
  }
}

function saveEvents(events: DownloadEvent[]) {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    /* storage full or blocked: the per-take ticks still work */
  }
}

export function loadSettings(): BudgetSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (raw && raw.plan in PLAN_LIMITS) return { plan: raw.plan, resetDay: clampDay(raw.resetDay) };
  } catch {
    /* fall through */
  }
  return { plan: "pro", resetDay: 1 };
}

export function saveSettings(s: BudgetSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const clampDay = (d: unknown) => Math.max(1, Math.min(28, Math.round(Number(d) || 1)));

/** Adds or removes the event for one take; returns the new list. */
export function recordDownload(events: DownloadEvent[], take: Take, downloaded: boolean, title: string, now = new Date()): DownloadEvent[] {
  const rest = events.filter((e) => e.takeId !== take.id);
  return downloaded ? [...rest, { takeId: take.id, at: now.toISOString(), title: title.slice(0, 80) }] : rest;
}

export function setDownloaded(take: Take, downloaded: boolean, title: string) {
  saveEvents(recordDownload(loadEvents(), take, downloaded, title));
}

/** Start of the current download cycle: the most recent `resetDay` on or before `now` (local time). */
export function cycleStart(resetDay: number, now = new Date()): Date {
  const day = clampDay(resetDay);
  const start = new Date(now.getFullYear(), now.getMonth(), day);
  if (start > now) start.setMonth(start.getMonth() - 1);
  return start;
}

export function nextReset(resetDay: number, now = new Date()): Date {
  const s = cycleStart(resetDay, now);
  return new Date(s.getFullYear(), s.getMonth() + 1, s.getDate());
}

export type Budget = { used: number; limit: number; left: number; monthly: boolean; resetsOn: Date | null };

export function budget(events: DownloadEvent[], settings: BudgetSettings, now = new Date()): Budget {
  const plan = PLAN_LIMITS[settings.plan];
  const from = plan.monthly ? cycleStart(settings.resetDay, now) : new Date(0);
  const used = events.filter((e) => new Date(e.at) >= from).length;
  return { used, limit: plan.limit, left: Math.max(0, plan.limit - used), monthly: plan.monthly, resetsOn: plan.monthly ? nextReset(settings.resetDay, now) : null };
}

// ---------------------------------------------------------------------------------------------
// Duplicate takes

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function similarity(a: string, b: string): number {
  const ta = new Set(splitTags(a).map(norm));
  const tb = new Set(splitTags(b).map(norm));
  if (!ta.size || !tb.size) return norm(a) === norm(b) ? 1 : 0;
  let both = 0;
  for (const t of ta) if (tb.has(t)) both++;
  return both / (ta.size + tb.size - both);
}

/**
 * An earlier take with the same (or nearly the same) prompt, if any. "same" = identical style and
 * exclude; "near" = 90%+ of the tags shared. Returns the most recent match.
 */
export function findDuplicate(takes: Take[], style: string, exclude: string): { take: Take; kind: "same" | "near" } | null {
  for (let i = takes.length - 1; i >= 0; i--) {
    const t = takes[i]!;
    if (norm(t.style) === norm(style) && norm(t.exclude) === norm(exclude)) return { take: t, kind: "same" };
  }
  for (let i = takes.length - 1; i >= 0; i--) {
    const t = takes[i]!;
    if (similarity(t.style, style) >= 0.9 && norm(t.exclude) === norm(exclude)) return { take: t, kind: "near" };
  }
  return null;
}
