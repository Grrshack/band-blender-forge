import { ArrowDown, ArrowUp, Disc3, Image, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TRACK_STATUSES,
  albumTips,
  loadAlbums,
  moveTrack,
  newAlbum,
  newTrack,
  parseLength,
  releaseType,
  runtime,
  saveAlbums,
  trackStyle,
  type Album,
  type AlbumTrack,
  type TrackStatus,
} from "@/lib/album";
import { formatTime } from "@/lib/audio/song-analysis";
import { nextStep, songSteps } from "@/lib/song-status";
import { cn } from "@/lib/utils";

/** Where the current song is, as an album-track status. */
function statusOf(state: ForgeState): TrackStatus {
  if (state.release?.masteredAt) return "mastered";
  if (state.takes.some((t) => t.rating >= 5)) return "keeper";
  if (state.takes.length) return "generating";
  const n = nextStep(songSteps(state));
  return n && (n.id === "sound" || n.id === "lyrics") && !state.blend.result ? "idea" : "writing";
}

/** Plan an EP or album: order, one shared sound with a twist per track, running time. Planning only. */
export function AlbumPlanner({ state, onGoTab }: { state: ForgeState; onGoTab: (tab: string) => void }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  useEffect(() => {
    const list = loadAlbums();
    setAlbums(list);
    setCurrentId(list[0]?.id ?? null);
  }, []);

  const album = albums.find((a) => a.id === currentId) ?? null;
  const commit = (next: Album[]) => {
    setAlbums(next);
    saveAlbums(next);
  };
  const update = (p: Partial<Album>) => {
    if (!album) return;
    commit(albums.map((a) => (a.id === album.id ? { ...a, ...p, updatedAt: new Date().toISOString() } : a)));
  };
  const updateTrack = (id: string, p: Partial<AlbumTrack>) =>
    album && update({ tracks: album.tracks.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const create = () => {
    const a = newAlbum("", state.release?.artist ?? "", state.blend.result?.styleTag ?? "");
    commit([a, ...albums]);
    setCurrentId(a.id);
  };

  const addCurrent = () => {
    if (!album) return;
    const title = state.lyrics.title || "This song";
    update({ tracks: [...album.tracks, newTrack(title, { status: statusOf(state) })] });
  };

  const openCover = () => {
    try {
      sessionStorage.setItem("bb.coverTitle", album?.title ?? "");
    } catch {
      /* ignore */
    }
    onGoTab("cover");
  };

  if (!album) {
    return (
      <Panel title="Album Planner" subtitle="Plan an EP or album: which songs, in what order, with one shared sound. Planning only; nothing is uploaded.">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Suno now lets you publish albums, and most artists release a few singles then an EP. Start a plan with this
            song&apos;s sound as the shared sound.
          </p>
          <Button onClick={create} className="glow-primary gap-2">
            <Disc3 className="size-4" /> Start an album or EP
          </Button>
        </div>
      </Panel>
    );
  }

  const kind = releaseType(album.tracks);
  const { seconds, unknown } = runtime(album.tracks);
  const tips = albumTips(album);

  return (
    <div className="space-y-5">
      <Panel
        title="Album Planner"
        subtitle="Saved in this browser. Planning only; nothing is uploaded."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {albums.length > 1 ? (
              <select value={album.id} onChange={(e) => setCurrentId(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs" aria-label="Which plan">
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title || "Untitled plan"}
                  </option>
                ))}
              </select>
            ) : null}
            <Button size="sm" variant="outline" onClick={create} className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" /> New plan
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={album.title} onChange={(e) => update({ title: e.target.value })} placeholder="Album or EP title" aria-label="Album title" />
          <Input value={album.artist} onChange={(e) => update({ artist: e.target.value })} placeholder="Artist name" aria-label="Artist" />
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="album-sound">
            Shared sound: the style every track keeps
          </label>
          <Textarea
            id="album-sound"
            value={album.sound}
            onChange={(e) => update({ sound: e.target.value })}
            rows={2}
            placeholder="e.g. dream pop, warm analog synths, airy female vocal, tape saturation"
            className="font-mono text-xs"
          />
          {state.blend.result?.styleTag && album.sound !== state.blend.result.styleTag ? (
            <button type="button" onClick={() => update({ sound: state.blend.result!.styleTag! })} className="mt-1 text-xs text-primary underline underline-offset-2">
              Use this song&apos;s sound
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">
            {kind === "empty" ? "No tracks yet" : kind === "EP" ? "EP" : kind === "album" ? "Album" : "Single"}
          </span>
          <span>{album.tracks.length} tracks</span>
          <span className="font-mono">
            {formatTime(seconds)}
            {unknown ? ` + ${unknown} without a length` : ""}
          </span>
          <span className="text-xs text-muted-foreground">Stores count 1–3 tracks as a single, 4–6 as an EP, 7+ or over 30 minutes as an album.</span>
        </div>
      </Panel>

      <Panel title="Tracks" subtitle="Reorder with the arrows. Each track keeps the shared sound and adds one twist.">
        <ol className="space-y-2">
          {album.tracks.map((t, i) => (
            <li key={t.id} className={cn("rounded-lg border p-3", t.single ? "border-primary/50" : "border-border")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 font-mono text-sm text-muted-foreground">{i + 1}</span>
                <Input value={t.title} onChange={(e) => updateTrack(t.id, { title: e.target.value })} placeholder="Track title" className="h-8 min-w-[160px] flex-1" aria-label={`Track ${i + 1} title`} />
                <Input
                  defaultValue={t.seconds ? formatTime(t.seconds) : ""}
                  onBlur={(e) => updateTrack(t.id, { seconds: parseLength(e.target.value) })}
                  placeholder="m:ss"
                  className="h-8 w-20 font-mono text-xs"
                  aria-label="Length"
                />
                <select
                  value={t.status}
                  onChange={(e) => updateTrack(t.id, { status: e.target.value as TrackStatus })}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                  aria-label="Status"
                >
                  {TRACK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updateTrack(t.id, { single: !t.single })}
                  className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-xs", t.single ? "border-primary/60 text-primary" : "border-border text-muted-foreground")}
                  aria-pressed={Boolean(t.single)}
                >
                  <Star className={cn("size-3", t.single && "fill-current")} /> Single
                </button>
                <span className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => update({ tracks: moveTrack(album.tracks, i, i - 1) })} aria-label="Move up" disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => update({ tracks: moveTrack(album.tracks, i, i + 1) })} aria-label="Move down" disabled={i === album.tracks.length - 1}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => update({ tracks: album.tracks.filter((x) => x.id !== t.id) })} aria-label="Remove track">
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                <Input
                  value={t.twist}
                  onChange={(e) => updateTrack(t.id, { twist: e.target.value })}
                  placeholder="Twist on the shared sound, e.g. slower, acoustic guitar, duet"
                  className="h-8 min-w-[200px] flex-1 text-xs"
                  aria-label="Twist"
                />
                {trackStyle(album, t) ? <CopyButton value={trackStyle(album, t)} label="Copy style" /> : null}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => update({ tracks: [...album.tracks, newTrack("")] })} className="gap-1.5">
            <Plus className="size-3.5" /> Add a track
          </Button>
          <Button variant="outline" size="sm" onClick={addCurrent} className="gap-1.5">
            <Plus className="size-3.5" /> Add the song you&apos;re working on
          </Button>
          <Button variant="outline" size="sm" onClick={openCover} className="gap-1.5">
            <Image className="size-3.5" /> Make the album cover
          </Button>
        </div>
      </Panel>

      {tips.length ? (
        <Panel title="Notes on this plan" subtitle="From the order and what's filled in.">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => {
            if (!window.confirm(`Delete the plan "${album.title || "Untitled plan"}"? Your songs aren't affected.`)) return;
            const next = albums.filter((a) => a.id !== album.id);
            commit(next);
            setCurrentId(next[0]?.id ?? null);
          }}
        >
          Delete this plan
        </Button>
      </div>
    </div>
  );
}
