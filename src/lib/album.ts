/**
 * Album / EP planning: tracks in order, one shared sound, running time and how stores will
 * count the release. Pure helpers plus browser storage (albums are small: titles and notes).
 */

export type TrackStatus = "idea" | "writing" | "generating" | "keeper" | "mastered";

export const TRACK_STATUSES: Array<{ value: TrackStatus; label: string }> = [
  { value: "idea", label: "Idea" },
  { value: "writing", label: "Writing" },
  { value: "generating", label: "In Suno" },
  { value: "keeper", label: "Keeper picked" },
  { value: "mastered", label: "Mastered" },
];

export type AlbumTrack = {
  id: string;
  title: string;
  /** A song saved in Band Blender (browser or account), if linked. */
  songId?: string;
  /** Length in seconds, typed or measured. */
  seconds?: number | undefined;
  status: TrackStatus;
  /** How this track differs from the shared sound, e.g. "slower, acoustic". */
  twist: string;
  single?: boolean;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  /** The core style every track shares. */
  sound: string;
  tracks: AlbumTrack[];
  updatedAt: string;
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function newAlbum(title = "", artist = "", sound = ""): Album {
  return { id: newId(), title, artist, sound, tracks: [], updatedAt: new Date().toISOString() };
}

export function newTrack(title = "", over: Partial<AlbumTrack> = {}): AlbumTrack {
  return { id: newId(), title, status: "idea", twist: "", ...over };
}

export function moveTrack(tracks: AlbumTrack[], from: number, to: number): AlbumTrack[] {
  if (to < 0 || to >= tracks.length || from === to) return tracks;
  const next = [...tracks];
  const [t] = next.splice(from, 1);
  next.splice(to, 0, t!);
  return next;
}

export function runtime(tracks: AlbumTrack[]): { seconds: number; unknown: number } {
  return {
    seconds: tracks.reduce((s, t) => s + (t.seconds ?? 0), 0),
    unknown: tracks.filter((t) => !t.seconds).length,
  };
}

/** "3:45" or "225" → seconds; empty or invalid → undefined. */
export function parseLength(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 3600 ? Math.round(n) : undefined;
}

/**
 * How Spotify and Apple usually count a release: a single is 1–3 tracks under 30 minutes, an
 * EP is 4–6 tracks under 30 minutes, an album is 7+ tracks or over 30 minutes.
 */
export function releaseType(tracks: AlbumTrack[]): "single" | "EP" | "album" | "empty" {
  const n = tracks.length;
  if (!n) return "empty";
  const { seconds } = runtime(tracks);
  if (n >= 7 || seconds > 30 * 60) return "album";
  return n <= 3 ? "single" : "EP";
}

/** Sequencing notes worth acting on, from the plan as it stands. */
export function albumTips(album: Album): string[] {
  const t = album.tracks;
  const tips: string[] = [];
  if (!t.length) return ["Add the songs you have, even as ideas. Order comes later."];
  if (!album.sound.trim()) tips.push("Set the shared sound, so every track sounds like the same record.");
  const singles = t.map((x, i) => (x.single ? i : -1)).filter((i) => i >= 0);
  if (!singles.length) tips.push("Mark a lead single: the track you'd send to playlists and post clips of.");
  else if (singles[0]! > 2) tips.push("Move the lead single into the first three tracks; most listeners start at the top.");
  if (t.length >= 3 && t[0]!.single !== true) tips.push("Open with a strong, immediate track: the opener decides whether people keep listening.");
  const missingTwist = t.filter((x) => !x.twist.trim()).length;
  if (album.sound.trim() && t.length >= 3 && missingTwist === t.length) {
    tips.push("Give each track one twist on the shared sound (tempo, instrument, mood), or the record blurs together.");
  }
  const kind = releaseType(t);
  if (kind === "single" && t.length > 1) tips.push("With 2–3 tracks, stores list this as a single. Add a 4th to make it an EP.");
  const { seconds, unknown } = runtime(t);
  if (kind === "EP" && seconds > 25 * 60 && !unknown) tips.push("Close to 30 minutes: past that, stores count it as an album.");
  const notStarted = t.filter((x) => x.status === "idea").length;
  if (notStarted && notStarted < t.length) tips.push(`${notStarted} track(s) still at the idea stage.`);
  return tips;
}

/** A style prompt for one track: the shared sound plus the track's twist. */
export function trackStyle(album: Album, track: AlbumTrack): string {
  return [album.sound.trim().replace(/[,\s]+$/, ""), track.twist.trim()].filter(Boolean).join(", ");
}

const KEY = "bb.albums";

export function loadAlbums(): Album[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Album[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveAlbums(list: Album[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* storage full or blocked */
  }
}
