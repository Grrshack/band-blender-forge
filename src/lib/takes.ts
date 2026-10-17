/**
 * Take log helpers: what changed between prompt versions, and what the ratings suggest.
 * Pure — no React, no network.
 */

export type Take = {
  id: string;
  /** ISO timestamp. */
  at: string;
  style: string;
  exclude: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string;
  /** Link to this take on suno.com, so a kept take can be shared as a recipe. */
  sunoUrl?: string;
};

/** Only links to suno.com are accepted, so shared recipes can't point anywhere else. */
export function isSunoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && (u.hostname === "suno.com" || u.hostname === "www.suno.com");
  } catch {
    return false;
  }
}

export const splitTags = (s: string): string[] =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const key = (t: string) => t.toLowerCase().replace(/\s+/g, " ");

/** Tags added to / removed from `prev` to get `next` (case-insensitive). */
export function diffTags(prev: string, next: string): { added: string[]; removed: string[] } {
  const a = splitTags(prev);
  const b = splitTags(next);
  const inA = new Set(a.map(key));
  const inB = new Set(b.map(key));
  return {
    added: b.filter((t) => !inA.has(key(t))),
    removed: a.filter((t) => !inB.has(key(t))),
  };
}

export function newTake(
  style: string,
  exclude: string,
  rating: Take["rating"],
  note: string,
  now: Date = new Date(),
  sunoUrl = "",
): Take {
  const link = sunoUrl.trim();
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    style,
    exclude,
    rating,
    note: note.trim().slice(0, 500),
    ...(link && isSunoUrl(link) ? { sunoUrl: link } : {}),
  };
}

/** The best-rated take; the most recent one wins ties. */
export function bestTake(takes: Take[]): Take | null {
  let best: Take | null = null;
  for (const t of takes) if (!best || t.rating >= best.rating) best = t;
  return best;
}

/**
 * Tags that appear in EVERY good take (4-5★) and in NO bad take (1-2★), and the reverse.
 * Needs at least two of each — with fewer takes there is nothing honest to say.
 */
export function tagPatterns(takes: Take[]): { helped: string[]; hurt: string[]; enough: boolean } {
  const good = takes.filter((t) => t.rating >= 4);
  const bad = takes.filter((t) => t.rating <= 2);
  if (good.length < 2 || bad.length < 2) return { helped: [], hurt: [], enough: false };

  const sets = (list: Take[]) => list.map((t) => new Set(splitTags(t.style).map(key)));
  const g = sets(good);
  const b = sets(bad);
  const original = new Map<string, string>();
  for (const t of takes) for (const tag of splitTags(t.style)) original.set(key(tag), tag);

  const all = [...original.keys()];
  const helped = all.filter((k) => g.every((s) => s.has(k)) && b.every((s) => !s.has(k)));
  const hurt = all.filter((k) => b.every((s) => s.has(k)) && g.every((s) => !s.has(k)));
  return {
    helped: helped.map((k) => original.get(k)!),
    hurt: hurt.map((k) => original.get(k)!),
    enough: true,
  };
}

/** Compact recent history for the model (oldest first), so it stops repeating failed changes. */
export function historyForPrompt(takes: Take[], n = 6) {
  return takes.slice(-n).map((t) => ({
    style: t.style,
    exclude: t.exclude,
    rating: t.rating,
    note: t.note,
  }));
}
