import { Clapperboard, ImageDown, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Panel } from "./Field";
import { Button } from "@/components/ui/button";
import {
  CANVAS_LOOKS,
  canvasVideoFormat,
  drawCanvasFrame,
  loopSeconds,
  renderSpotifyCanvas,
  spotifyCanvasStill,
  type CanvasLook,
} from "@/lib/spotify-canvas";
import { cn } from "@/lib/utils";

/** A 3-8 second silent loop for Spotify's Now Playing view, made from the cover. */
export function SpotifyCanvasPanel({
  cover,
  bpm,
  baseName,
  onPickCover,
  onMakeCover,
  onSave,
}: {
  cover: HTMLImageElement | null;
  bpm: number | null;
  baseName: string;
  onPickCover: () => void;
  onMakeCover: () => void;
  onSave: (blob: Blob, name: string) => void;
}) {
  const [look, setLook] = useState<CanvasLook>("drift");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const loop = loopSeconds(bpm);
  const fmt = typeof window !== "undefined" ? canvasVideoFormat() : null;

  // Live preview, looping the same frames the export will record.
  useEffect(() => {
    const c = preview.current;
    if (!c || !cover) return;
    c.width = 540;
    c.height = 960;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = ((performance.now() - t0) / 1000) % loop;
      ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      drawCanvasFrame(ctx, cover, look, t, loop, bpm);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cover, look, loop, bpm]);

  const exportVideo = async () => {
    if (!cover) return;
    setError(null);
    setNote(null);
    setProgress(0);
    try {
      const out = await renderSpotifyCanvas({ cover, look, bpm, onProgress: setProgress });
      onSave(out.blob, `${baseName}-spotify-canvas.${out.ext}`);
      if (out.ext !== "mp4") {
        setNote("Spotify takes MP4, and this browser recorded WebM. Use Safari or an up-to-date Chrome for MP4, or upload the JPG still instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Canvas couldn't be made.");
    } finally {
      setProgress(null);
    }
  };

  const exportStill = async () => {
    if (!cover) return;
    try {
      onSave(await spotifyCanvasStill(cover, look), `${baseName}-spotify-canvas.jpg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the image.");
    }
  };

  return (
    <Panel
      title="Spotify Canvas"
      subtitle="The short silent loop behind your song in Spotify's Now Playing view: 9:16, 3 to 8 seconds, made from your cover."
    >
      {cover ? (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-3">
            <div role="radiogroup" aria-label="Canvas look" className="grid gap-1.5 sm:grid-cols-3">
              {CANVAS_LOOKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={look === l.id}
                  onClick={() => setLook(l.id)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left",
                    look === l.id ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {bpm
                ? `Loops every ${loop.toFixed(1)} s: a whole number of bars at ${bpm} BPM, so the pulse never jumps.`
                : `Loops every ${loop} s. Add the song above to sync the loop to its tempo.`}{" "}
              No title or artist on it: Spotify already shows those.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void exportVideo()} disabled={progress !== null || !fmt} className="glow-primary gap-2">
                {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
                {progress !== null ? `Recording… ${Math.round(progress * 100)}%` : `Make the Canvas${fmt ? ` (${fmt.ext.toUpperCase()})` : ""}`}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void exportStill()} className="gap-1.5 text-xs">
                <ImageDown className="size-3.5" /> JPG still
              </Button>
              <Button variant="ghost" size="sm" onClick={onPickCover} className="gap-1.5 text-xs">
                <ImagePlus className="size-3.5" /> Change cover
              </Button>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {note ? <p className="text-xs text-signal-mid">{note}</p> : null}
            <p className="text-[11px] text-muted-foreground">
              Upload it in Spotify for Artists, on the song&apos;s page under Canvas. Edges can be cropped on some
              phones, so the cover stays in the middle.
            </p>
          </div>
          <canvas
            ref={preview}
            className="mx-auto aspect-[9/16] w-full max-w-[200px] rounded-xl border border-border"
            aria-label="Spotify Canvas preview"
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button size="sm" variant="outline" onClick={onPickCover} className="gap-1.5 text-xs">
            <ImagePlus className="size-3.5" /> Add your cover
          </Button>
          <button type="button" onClick={onMakeCover} className="text-xs text-primary underline underline-offset-2">
            or make one in Cover Maker
          </button>
        </div>
      )}
    </Panel>
  );
}
