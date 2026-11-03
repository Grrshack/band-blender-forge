import { FileArchive } from "lucide-react";
import { toast } from "sonner";

import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { buildSongPack } from "@/lib/song-pack";

/** Builds the song pack zip in the browser and downloads it. */
export async function downloadSongPack(name: string, state: ForgeState) {
  try {
    const pack = await buildSongPack(name, state);
    const url = URL.createObjectURL(pack.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pack.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Song pack downloaded (${pack.count} files).`);
  } catch (e) {
    console.error("Song pack failed", e);
    toast.error("Couldn't build the song pack. Try Export → Brief only instead.");
  }
}

/** The end of the release tools: everything for this song in one download. */
export function SongPackCard({ state }: { state: ForgeState }) {
  const name = state.lyrics.title.trim() || "Untitled song";
  return (
    <section className="panel-surface flex flex-wrap items-center gap-3 p-4">
      <FileArchive className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Download everything</p>
        <p className="text-xs text-muted-foreground">
          Style, lyrics, synced lyrics, release kit, AI answers and cover, each as its own file in one zip.
        </p>
      </div>
      <Button size="sm" onClick={() => void downloadSongPack(name, state)} className="gap-1.5">
        <FileArchive className="size-3.5" /> Song pack (.zip)
      </Button>
    </section>
  );
}
