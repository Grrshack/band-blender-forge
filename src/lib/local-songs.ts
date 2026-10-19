import type { ForgeState } from "@/components/forge/types";
import { emptyState, hasContent, mergeState } from "@/components/forge/types";

const KEY = "blf.local-songs";
const MAX = 20;

export type LocalSong = {
  id: string;
  name: string;
  updated_at: number;
  state: ForgeState;
};

function read(): LocalSong[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s): LocalSong | null => {
        if (!s || typeof s !== "object") return null;
        return {
          id: String(s.id ?? ""),
          name: String(s.name ?? "Untitled"),
          updated_at: Number(s.updated_at ?? Date.now()),
          state: mergeState(s.state),
        };
      })
      .filter((s): s is LocalSong => s !== null && s.id);
  } catch {
    return [];
  }
}

function write(songs: LocalSong[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs.slice(0, MAX)));
  } catch {
    /* storage full or unavailable */
  }
}

export function listLocalSongs(): LocalSong[] {
  return read().sort((a, b) => b.updated_at - a.updated_at);
}

export function saveLocalSong(id: string | null, name: string, state: ForgeState): LocalSong {
  const songs = read();
  const now = Date.now();
  if (id) {
    const idx = songs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      songs[idx] = { ...songs[idx]!, name, updated_at: now, state };
      write(songs);
      return songs[idx]!;
    }
  }
  const song: LocalSong = {
    id: `local-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: name || "Untitled song",
    updated_at: now,
    state,
  };
  write([song, ...songs]);
  return song;
}

export function deleteLocalSong(id: string) {
  write(read().filter((s) => s.id !== id));
}

export function getLocalSong(id: string): LocalSong | null {
  return read().find((s) => s.id === id) ?? null;
}

export { hasContent, emptyState };
