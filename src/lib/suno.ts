/**
 * Suno-specific rules, kept pure (no DOM, no React, no network) so they run on
 * the server, in the browser and in plain-node tests.
 *
 * Limits come from third-party measurements of Suno's fields (style 1,000,
 * exclude 1,000, lyrics 5,000, title 100). Suno can change them; this is the
 * one place to update.
 */

export const SUNO_LIMITS = { style: 1000, exclude: 1000, lyrics: 5000, title: 100 } as const;

/** Keep the style prompt a little under the hard cap so edits have headroom. */
export const STYLE_TARGET = 850;

/** Suno generation versions supported for targeting. */
export type SunoVersion = "mini" | "v6" | "pro";

/** Per-version style tag character targets.
 * - mini: shorter prompts, less complex model
 * - v6:   balanced, natural language descriptions work well
 * - pro:  near-full limit, supports richer detail
 */
export const STYLE_TARGET_FOR_VERSION: Record<SunoVersion, number> = {
  mini: 400,
  v6: 700,
  pro: 950,
};

/** Human-readable labels for the version selector. */
export const SUNO_VERSION_LABELS: Record<SunoVersion, string> = {
  mini: "v6 Mini",
  v6: "Suno v6",
  pro: "v6 Pro",
};

type Json = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Artist-name detection & scrubbing                                   */
/* ------------------------------------------------------------------ */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strips diacritics one UTF-16 unit at a time, so indices stay aligned with the original. */
function fold(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    const d = c.normalize("NFD");
    out += d.length > 1 && /[\u0300-\u036f]/.test(d.slice(1)) ? d[0]! : c;
  }
  return out;
}

const LEAD_INS =
  "in the style of|sounds? like|reminiscent of|inspired by|in the vein of|similar to|a la";
const SUFFIX = "(?:['’]s|-(?:style|esque|like|inspired|influenced))?";

function nameTokens(name: string): string[] {
  return fold(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Regex sources (for the folded text) that match one artist name, with and without "The". */
function nameSources(rawName: string): { source: string; flags: string }[] {
  const name = rawName.trim();
  const tokens = nameTokens(name);
  if (!name || tokens.length === 0) return [];

  const L = "(?<![A-Za-z0-9])";
  const R = "(?![A-Za-z0-9])";

  // Short single words ("Air", "Yes", "Rush", "Cake") are also ordinary English, so
  // only flag the exact casing the user typed — "airy vocals" must not trip "Air".
  if (tokens.length === 1 && tokens[0]!.length < 5) {
    return [{ source: `${L}${escapeRe(fold(name))}${SUFFIX}${R}`, flags: "g" }];
  }

  const build = (t: string[]) =>
    `${L}${t.map((x) => (x === "and" ? "(?:and|&)" : escapeRe(x))).join("[^a-z0-9]+")}${SUFFIX}${R}`;
  const out = [{ source: build(tokens), flags: "gi" }];
  if (tokens[0] === "the" && tokens.length > 1) {
    out.push({ source: build(tokens.slice(1)), flags: "gi" });
  }
  return out;
}

// "in the style of Some Artist" — the capitalised run after the lead-in is treated as a name.
const GENERIC_LEAD =
  "(?:[Ii]n the style of|[Ss]ounds? like|[Rr]eminiscent of|[Ii]n the vein of|[Àà] la)\\s+";
const GENERIC_NAME = "(?:[A-ZÀ-Ý][\\w'’.&-]*(?:[ \\t]+|(?=[,;.)]|$))){1,4}";

type Range = [number, number];

function findRanges(text: string, names: string[]): Range[] {
  const folded = fold(text);
  const ranges: Range[] = [];

  for (const n of names) {
    for (const { source, flags } of nameSources(n)) {
      // swallow a lead-in directly in front of the name ("inspired by X", "à la X")
      const re = new RegExp(`(?:(?:${LEAD_INS})\\s+)?${source}`, flags);
      for (const m of folded.matchAll(re)) ranges.push([m.index!, m.index! + m[0].length]);
    }
  }

  const generic = new RegExp(`${GENERIC_LEAD}${GENERIC_NAME}`, "g");
  for (const m of folded.matchAll(generic)) {
    ranges.push([m.index!, m.index! + m[0].replace(/\s+$/, "").length]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Returns the offending snippets (empty array = clean). */
export function findStyleLeaks(text: string, names: string[]): string[] {
  if (!text) return [];
  const hits = findRanges(text, names).map(([a, b]) => text.slice(a, b).trim());
  return [...new Set(hits)];
}

function tidy(s: string): string {
  let out = s
    .replace(
      /\b(?:in the style of|sounds? like|reminiscent of|inspired by|in the vein of|similar to|[àa] la)\s*(?=,|;|$)/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/([,;]\s*){2,}/g, ", ")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "");
  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

export function scrubArtistNames(
  text: string,
  names: string[],
): { text: string; removed: string[] } {
  const ranges = findRanges(text, names);
  if (!ranges.length) return { text, removed: [] };
  const removed = ranges.map(([a, b]) => text.slice(a, b).trim());
  let out = text;
  for (const [a, b] of [...ranges].reverse()) out = out.slice(0, a) + " " + out.slice(b);
  return { text: tidy(out), removed: [...new Set(removed)] };
}

/** Cuts at the last comma that keeps the text within `max`, so no tag is sliced in half. */
export function fitToLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const comma = cut.lastIndexOf(",");
  return (comma > max * 0.5 ? cut.slice(0, comma) : cut).trim();
}

/* ------------------------------------------------------------------ */
/* Blend result enforcement                                            */
/* ------------------------------------------------------------------ */

const STYLE_KEYS = [
  "genre",
  "tempo",
  "instrumentation",
  "vocals",
  "mood",
  "styleTag",
  "excludeStyles",
] as const;
const VOCAL_KEYS = ["voice", "delivery", "harmonies", "effects"] as const;

/** Every field that ends up in a Suno style/vocal/exclude box. `reconciliation` is deliberately absent. */
function mapStyleFields(blend: Json, fn: (text: string, key: string) => string): Json {
  const out: Json = { ...blend };
  for (const k of STYLE_KEYS) {
    if (typeof out[k] === "string") out[k] = fn(out[k] as string, k);
  }
  const vp = out["vocalPrompt"];
  if (vp && typeof vp === "object") {
    const next: Json = { ...(vp as Json) };
    for (const k of VOCAL_KEYS) {
      if (typeof next[k] === "string") next[k] = fn(next[k] as string, `vocalPrompt.${k}`);
    }
    out["vocalPrompt"] = next;
  }
  return out;
}

export function blendLeaks(blend: Json, names: string[]): string[] {
  const found: string[] = [];
  mapStyleFields(blend, (t) => {
    found.push(...findStyleLeaks(t, names));
    return t;
  });
  return [...new Set(found)];
}

export function scrubBlend(blend: Json, names: string[]): { blend: Json; removed: string[] } {
  const removed: string[] = [];
  const out = mapStyleFields(blend, (t, key) => {
    const r = scrubArtistNames(t, names);
    removed.push(...r.removed);
    if (key === "styleTag") return fitToLimit(r.text, SUNO_LIMITS.style);
    if (key === "excludeStyles") return fitToLimit(r.text, SUNO_LIMITS.exclude);
    return r.text;
  });
  return { blend: out, removed: [...new Set(removed)] };
}

/**
 * Guarantees the style fields carry no artist names. If the model leaked any, it is
 * asked once to rewrite; whatever survives is stripped in code. `styleWarnings`
 * lists anything that had to be stripped so the UI can say so.
 */
export async function enforceNoArtistNames(
  blend: Json,
  names: string[],
  reask: (feedback: string) => Promise<Json>,
): Promise<Json> {
  let current = blend;
  const leaks = blendLeaks(current, names);
  if (leaks.length) {
    try {
      const again = await reask(
        `Your previous answer put these in a style field: ${leaks.map((l) => `"${l}"`).join(", ")}. ` +
          `Style fields must contain zero real artist, band, producer, label or song names. ` +
          `Rewrite the complete JSON, describing the sound only (genre, tempo, instruments, vocal traits, production).`,
      );
      if (again && typeof again === "object") current = again;
    } catch {
      /* fall through: scrub the original */
    }
  }
  const { blend: clean, removed } = scrubBlend(current, names);
  return removed.length ? { ...clean, styleWarnings: removed } : clean;
}

/* ------------------------------------------------------------------ */
/* Suno-format text                                                    */
/* ------------------------------------------------------------------ */

export type SunoSection = { tag: string; cue?: string | undefined; lines: { text: string }[] };

const bracket = (s: string) => {
  const inner = s
    .trim()
    .replace(/^\[+|\]+$/g, "")
    .trim();
  return inner ? `[${inner}]` : "";
};

/** Section tag, optional performance cue on its own bracketed line, then the lines. */
export function composeSunoLyrics(sections: SunoSection[]): string {
  return sections
    .map((s) =>
      [bracket(s.tag), s.cue ? bracket(s.cue) : "", ...s.lines.map((l) => l.text)]
        .filter((x) => x !== "")
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}

export type VocalPrompt = {
  voice?: string;
  delivery?: string;
  harmonies?: string;
  effects?: string;
};

/** One comma-separated line suitable for appending to the style box. */
export function vocalString(vp: VocalPrompt | undefined): string {
  if (!vp) return "";
  return [vp.voice, vp.delivery, vp.harmonies, vp.effects]
    .map((x) => (x ?? "").trim())
    .filter((x) => x && !/^none\.?$/i.test(x))
    .join(", ");
}

// ─── Genre targeting ─────────────────────────────────────────────────────────

export type GenreGroup = { label: string; genres: string[] };

export const GENRE_GROUPS: GenreGroup[] = [
  {
    label: "Electronic",
    genres: ["House", "Techno", "Drum & Bass", "Dubstep", "Ambient", "Synthwave", "Trip-hop", "IDM"],
  },
  {
    label: "Hip-hop & R&B",
    genres: ["Hip-hop", "Trap", "Drill", "R&B", "Neo-Soul", "Lo-fi Hip-hop", "Boom Bap"],
  },
  {
    label: "Rock & Metal",
    genres: ["Rock", "Indie Rock", "Alternative", "Metal", "Post-Rock", "Punk", "Grunge", "Shoegaze"],
  },
  {
    label: "Pop",
    genres: ["Pop", "Synth-pop", "Dream Pop", "Art Pop", "Hyperpop", "K-pop"],
  },
  {
    label: "Folk & Country",
    genres: ["Folk", "Indie Folk", "Country", "Americana", "Bluegrass", "Singer-Songwriter"],
  },
  {
    label: "Jazz & Soul",
    genres: ["Jazz", "Soul", "Funk", "Blues", "Gospel", "Nu-Jazz"],
  },
  {
    label: "World & Classical",
    genres: ["Classical", "Orchestral", "Cinematic", "Afrobeat", "Latin", "Reggae", "Bossa Nova"],
  },
];

/** Flat sorted list for autocomplete / search. */
export const ALL_GENRES: string[] = GENRE_GROUPS.flatMap((g) => g.genres).sort();
