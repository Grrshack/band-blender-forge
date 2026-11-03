/**
 * The admin "Lab": weekly Lab Picks (generated, reviewed, then scheduled for a Monday or
 * Friday drop) and the Album Producer (a whole EP or album of styles and lyrics).
 * Pure helpers only; the screens are LabPicksAdmin and AlbumProducer.
 */
import { songPackFiles, packSlug } from "@/lib/song-pack";
import type { Album } from "@/lib/album";
import { emptyState, type BlendResult, type ForgeState, type Section } from "@/components/forge/types";

// ---------------------------------------------------------------------------------------------
// Lab Picks: who to blend

/** Well-known acts in clearly different lanes, so two from different lanes make a real clash. */
export const SEED_BUCKETS: Array<{ lane: string; artists: string[] }> = [
  { lane: "Trip-hop", artists: ["Portishead", "Massive Attack", "Tricky", "Morcheeba"] },
  { lane: "Shoegaze & dream pop", artists: ["My Bloody Valentine", "Slowdive", "Cocteau Twins", "Beach House"] },
  { lane: "Alt-metal", artists: ["Deftones", "Tool", "System of a Down", "Gojira"] },
  { lane: "Neo-soul", artists: ["Erykah Badu", "D'Angelo", "Hiatus Kaiyote", "Jill Scott"] },
  { lane: "Synthpop & new wave", artists: ["Depeche Mode", "New Order", "Tears for Fears", "Chvrches"] },
  { lane: "Math & post-rock", artists: ["Polyphia", "Explosions in the Sky", "Battles", "Mogwai"] },
  { lane: "Electronic", artists: ["Daft Punk", "Aphex Twin", "Bonobo", "Justice"] },
  { lane: "Hip-hop", artists: ["A Tribe Called Quest", "Kendrick Lamar", "OutKast", "MF DOOM"] },
  { lane: "Country & Americana", artists: ["Johnny Cash", "Kacey Musgraves", "Chris Stapleton", "Dolly Parton"] },
  { lane: "Jazz", artists: ["Miles Davis", "Kamasi Washington", "Nina Simone", "Herbie Hancock"] },
  { lane: "Indie & alt-rock", artists: ["Radiohead", "Arctic Monkeys", "Pixies", "The Strokes"] },
  { lane: "Pop", artists: ["Billie Eilish", "Lorde", "Robyn", "Dua Lipa"] },
  { lane: "Folk", artists: ["Bon Iver", "Fleet Foxes", "Joni Mitchell", "Phoebe Bridgers"] },
  { lane: "Latin & Afro", artists: ["Rosalía", "Bad Bunny", "Fela Kuti", "Burna Boy"] },
  { lane: "Punk & emo", artists: ["Paramore", "My Chemical Romance", "The Clash", "Turnstile"] },
  { lane: "Funk & disco", artists: ["Prince", "Chic", "Parliament", "Earth, Wind & Fire"] },
  { lane: "Ambient & cinematic", artists: ["Brian Eno", "Hans Zimmer", "Sigur Rós", "Ólafur Arnalds"] },
  { lane: "Hyperpop & glitch", artists: ["100 gecs", "SOPHIE", "Charli XCX", "Crystal Castles"] },
];

/** One way to name a pair, whatever the order or capitals. */
export const pairKey = (artists: string[]) =>
  artists
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(" | ");

/**
 * Picks `n` artist pairs from different lanes, skipping pairs used recently and never using
 * the same artist twice in one batch. `rand` is injectable so tests are repeatable.
 */
export function pickSeeds(n: number, avoid: Set<string> = new Set(), rand: () => number = Math.random): string[][] {
  const out: string[][] = [];
  const usedArtists = new Set<string>();
  const usedKeys = new Set(avoid);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  for (let guard = 0; out.length < n && guard < 500; guard++) {
    const a = pick(SEED_BUCKETS);
    const b = pick(SEED_BUCKETS);
    if (a.lane === b.lane) continue;
    const pair = [pick(a.artists), pick(b.artists)];
    const key = pairKey(pair);
    if (usedKeys.has(key) || pair.some((x) => usedArtists.has(x))) continue;
    usedKeys.add(key);
    pair.forEach((x) => usedArtists.add(x));
    out.push(pair);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Lab Picks: drafts and drop dates

export type LabDraft = {
  id: string;
  artists: string[];
  title: string;
  styleTag: string;
  excludeStyles: string;
  vocalPrompt?: Record<string, string> | undefined;
  genre: string;
  status: "waiting" | "making" | "ready" | "failed";
  error?: string | undefined;
};

export const newDraft = (artists: string[]): LabDraft => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  artists,
  title: artists.join(" × ").slice(0, 80),
  styleTag: "",
  excludeStyles: "",
  genre: "",
  status: "waiting",
});

/** Fills a draft from a blend result (always the tag list: it works on every Suno version). */
export function draftFromBlend(d: LabDraft, r: BlendResult): LabDraft {
  const vocal = r.vocalPrompt
    ? Object.fromEntries(Object.entries(r.vocalPrompt).filter(([, v]) => typeof v === "string" && v.trim()))
    : undefined;
  return {
    ...d,
    styleTag: (r.styleTag ?? "").trim(),
    excludeStyles: (r.excludeStyles ?? "").trim(),
    ...(vocal && Object.keys(vocal).length ? { vocalPrompt: vocal as Record<string, string> } : {}),
    genre: (r.genre ?? "").trim(),
    status: (r.styleTag ?? "").trim() ? "ready" : "failed",
    ...((r.styleTag ?? "").trim() ? {} : { error: "The AI didn't return a style." }),
  };
}

/** Short genre tags for the library filter, from the blend's genre line. */
export function genreTags(genre: string): string[] {
  return genre
    .toLowerCase()
    .split(/[,/&+]|\band\b/)
    .map((g) => g.trim())
    .filter((g) => g.length >= 3 && g.length <= 30)
    .slice(0, 3);
}

/** The next given weekday (1 = Monday, 5 = Friday) at `hour`:00 local time, always in the future. */
export function nextDrop(weekday: number, hour = 9, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  let add = (weekday - d.getDay() + 7) % 7;
  if (add === 0 && d <= now) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

/** "Monday drop · Nov 2" in the viewer's language. */
export function dropLabel(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Lab Pick";
  const day = d.toLocaleDateString(locale, { weekday: "long" });
  const date = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${day} drop · ${date}`;
}

/** Picks from the newest drop that has already happened (they share one drop time). */
export function currentDrop<T extends { drop_at: string | null }>(picks: T[], now: Date = new Date()): T[] {
  const live = picks.filter((p) => p.drop_at && new Date(p.drop_at) <= now);
  if (!live.length) return [];
  const newest = live.reduce((m, p) => (p.drop_at! > m ? p.drop_at! : m), live[0]!.drop_at!);
  const day = newest.slice(0, 10);
  return live.filter((p) => p.drop_at!.slice(0, 10) === day);
}

// ---------------------------------------------------------------------------------------------
// Album Producer

export type ProducedTrack = {
  n: number;
  title: string;
  role: string;
  styleTag: string;
  twist: string;
  theme: string;
  hook: string;
  bpm?: number | undefined;
  /** Filled once its lyrics are written. */
  lyricTitle?: string | undefined;
  sections?: Section[] | undefined;
  /** The saved song in My Songs. */
  songId?: string | undefined;
  status: "planned" | "writing" | "done" | "failed";
  error?: string | undefined;
};

export type AlbumProject = {
  id: string;
  createdAt: string;
  concept: string;
  artists: string[];
  artistName: string;
  title: string;
  summary: string;
  sharedSound: string;
  excludeStyles: string;
  tracks: ProducedTrack[];
  /** The matching album in Album Planner. */
  plannerId?: string | undefined;
};

/** Turns the cleaned AI plan into a project. */
export function projectFromPlan(
  plan: Record<string, unknown>,
  input: { concept: string; artists: string[]; artistName: string },
): AlbumProject {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const tracks = (Array.isArray(plan["tracks"]) ? (plan["tracks"] as Array<Record<string, unknown>>) : []).map(
    (t, i): ProducedTrack => ({
      n: i + 1,
      title: str(t["title"]) || `Track ${i + 1}`,
      role: str(t["role"]),
      styleTag: str(t["styleTag"]),
      twist: str(t["twist"]),
      theme: str(t["theme"]),
      hook: str(t["hook"]),
      ...(typeof t["bpm"] === "number" ? { bpm: t["bpm"] } : {}),
      status: "planned",
    }),
  );
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    concept: input.concept,
    artists: input.artists,
    artistName: input.artistName,
    title: str(plan["title"]) || "Untitled record",
    summary: str(plan["concept"]),
    sharedSound: str(plan["sharedSound"]),
    excludeStyles: str(plan["excludeStyles"]),
    tracks,
  };
}

/** The payload for the existing "lyrics" task, so album lyrics follow every Lyric Forge rule. */
export function lyricsPayload(p: AlbumProject, t: ProducedTrack): Record<string, unknown> {
  return {
    theme: t.theme,
    hookIdea: t.hook,
    notes: [
      `Track ${t.n} of ${p.tracks.length} on the record "${p.title}"${p.summary ? ` (${p.summary})` : ""}.`,
      t.role ? `Its role on the record: ${t.role}.` : "",
      t.twist ? `How it differs from the others: ${t.twist}.` : "",
      `Use "${t.title}" as the title unless a better one comes from the hook.`,
    ]
      .filter(Boolean)
      .join(" "),
    style: { styleTag: t.styleTag, genre: p.sharedSound.split(",")[0]?.trim() ?? "", vocals: "", mood: "", vocalPrompt: "" },
    bannedWords: [],
  };
}

/** Turns a lyrics answer into Lyric Forge sections. */
export function sectionsFrom(out: { sections?: Array<{ tag?: string; cue?: string; lines?: string[] }> }): Section[] {
  return (out.sections ?? []).map((s) => ({
    tag: s.tag ?? "[Section]",
    ...(s.cue ? { cue: s.cue } : {}),
    lines: (s.lines ?? []).map((text) => ({ text, locked: false })),
  }));
}

/** One track as a normal Band Blender song, ready to save in My Songs or open in the studio. */
export function trackState(p: AlbumProject, t: ProducedTrack): ForgeState {
  const s = emptyState();
  s.blend.artists = [...p.artists, "", "", ""].slice(0, 3);
  s.blend.result = {
    styleTag: t.styleTag,
    styleFormat: "tags",
    excludeStyles: p.excludeStyles,
    genre: p.sharedSound.split(",")[0]?.trim() ?? "",
    ...(t.bpm ? { tempo: `${t.bpm} BPM` } : {}),
  };
  s.lyrics.title = t.lyricTitle || t.title;
  s.lyrics.theme = t.theme;
  s.lyrics.hook = t.hook;
  s.lyrics.sections = t.sections ?? [];
  if (p.artistName) s.release = { artist: p.artistName };
  return s;
}

/** The song's name in My Songs: "Glass City — 01 Neon Rain". */
export const trackSongName = (p: AlbumProject, t: ProducedTrack) =>
  `${p.title} — ${String(t.n).padStart(2, "0")} ${t.lyricTitle || t.title}`.slice(0, 120);

/** The same record as an Album Planner album, linked to the saved songs. */
export function plannerAlbum(p: AlbumProject, existing?: Album): Album {
  return {
    id: existing?.id ?? p.plannerId ?? p.id,
    title: p.title,
    artist: p.artistName,
    sound: p.sharedSound,
    tracks: p.tracks.map((t) => {
      const prev = existing?.tracks.find((x) => x.songId && x.songId === t.songId);
      return {
        id: prev?.id ?? `${p.id}-${t.n}`,
        title: t.lyricTitle || t.title,
        ...(t.songId ? { songId: t.songId } : {}),
        status: prev?.status ?? (t.status === "done" ? "writing" : "idea"),
        twist: t.twist,
        ...(t.n === 2 ? { single: true } : {}),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

/** Every file in the album zip: a tracklist, then a song pack folder per finished track. */
export function albumZipFiles(p: AlbumProject): Array<[string, string]> {
  const root = packSlug(p.title);
  const done = p.tracks.filter((t) => t.status === "done");
  const tracklist = [
    `${p.title}${p.artistName ? ` — ${p.artistName}` : ""}`,
    p.summary,
    "",
    `Shared sound: ${p.sharedSound}`,
    p.excludeStyles ? `Keep out of every track: ${p.excludeStyles}` : "",
    "",
    ...p.tracks.map(
      (t) =>
        `${String(t.n).padStart(2, "0")}. ${t.lyricTitle || t.title}${t.role ? ` (${t.role})` : ""}${t.bpm ? ` · ${t.bpm} BPM` : ""}${t.status === "done" ? "" : " · lyrics not written yet"}`,
    ),
    "",
    "Each numbered folder is a song pack: paste suno/style.txt, suno/exclude.txt and suno/lyrics.txt into Suno.",
    "",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
  const files: Array<[string, string]> = [[`${root}/TRACKLIST.txt`, tracklist]];
  for (const t of done) {
    const folder = `${root}/${String(t.n).padStart(2, "0")}-${packSlug(t.lyricTitle || t.title)}`;
    for (const [path, text] of songPackFiles(t.lyricTitle || t.title, trackState(p, t))) {
      files.push([`${folder}/${path}`, text]);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------------------------
// Browser storage (admin's browser only; the songs themselves are saved to the account)

const DRAFTS_KEY = "bb.lab.drafts";
const PROJECTS_KEY = "bb.lab.albums";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
function write(key: string, v: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
}
export const loadDrafts = () => read<LabDraft>(DRAFTS_KEY);
export const saveDrafts = (d: LabDraft[]) => write(DRAFTS_KEY, d.slice(0, 20));
export const loadProjects = () => read<AlbumProject>(PROJECTS_KEY);
export const saveProjects = (p: AlbumProject[]) => write(PROJECTS_KEY, p.slice(0, 12));
