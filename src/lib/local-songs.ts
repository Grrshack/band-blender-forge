import type { ForgeState } from "@/components/forge/types";
import { emptyState, hasContent, mergeState } from "@/components/forge/types";

/**
 * Songs for people who aren't signed in, kept in this browser's localStorage.
 * Signed-in users save to the cloud instead (see WorkspaceBar).
 */
const KEY = "blf.local-songs";
export const MAX_LOCAL_SONGS = 20;

export type LocalSong = {
  id: string;
  name: string;
  updated_at: number;
  state: ForgeState;
};

export const isLocalId = (id: string | null | undefined): boolean => !!id && id.startsWith("local-");

const newest = (a: LocalSong, b: LocalSong) => b.updated_at - a.updated_at;

function read(): LocalSong[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s): LocalSong | null => {
        if (!s || typeof s !== "object") return null;
        const o = s as Record<string, unknown>;
        const id = String(o["id"] ?? "");
        if (!id) return null;
        const updated = Number(o["updated_at"]);
        return {
          id,
          name: String(o["name"] ?? "Untitled song"),
          updated_at: Number.isFinite(updated) ? updated : 0,
          state: mergeState(o["state"]),
        };
      })
      .filter((s): s is LocalSong => s !== null);
  } catch {
    return [];
  }
}

/** Writes newest-first, keeping the most recently edited songs. False if the browser refused. */
function write(songs: LocalSong[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify([...songs].sort(newest).slice(0, MAX_LOCAL_SONGS)));
    return true;
  } catch {
    return false; // storage full, private mode, or blocked
  }
}

export function listLocalSongs(): LocalSong[] {
  return read().sort(newest);
}

export type LocalSaveResult = {
  song: LocalSong;
  /** False when the browser wouldn't store it (usually storage full). */
  ok: boolean;
  /** Name of a song pushed out by the 20-song limit, if any. */
  dropped: string | null;
};

export function saveLocalSong(id: string | null, name: string, state: ForgeState): LocalSaveResult {
  const songs = read();
  const now = Date.now();
  const idx = id ? songs.findIndex((s) => s.id === id) : -1;
  let song: LocalSong;
  if (idx >= 0) {
    song = { ...songs[idx]!, name: name || "Untitled song", updated_at: now, state };
    songs[idx] = song;
  } else {
    song = {
      id: `local-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || "Untitled song",
      updated_at: now,
      state,
    };
    songs.push(song);
  }
  const sorted = [...songs].sort(newest);
  const dropped = sorted.length > MAX_LOCAL_SONGS ? (sorted[MAX_LOCAL_SONGS]?.name ?? null) : null;
  return { song, ok: write(songs), dropped };
}

export function deleteLocalSong(id: string): void {
  write(read().filter((s) => s.id !== id));
}

export function getLocalSong(id: string): LocalSong | null {
  return read().find((s) => s.id === id) ?? null;
}

export { hasContent, emptyState };
