import { ListOrdered, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorNote, Panel } from "./Field";
import { SongDrop, SongMeasurements, useSongAnalysis } from "./SongMeasurements";
import { useSettings } from "./settings";
import type { BlendResult, BlendSlice, LyricSlice } from "./types";
import { useForge } from "./use-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { measuredForPrompt, structureFromSections } from "@/lib/audio/song-analysis";
import { track } from "@/lib/stats";

/**
 * Analyze a song you love: measured in the browser (tempo, key, sections, tone), then the
 * AI turns the numbers plus what the person knows or hears into a Suno prompt.
 */
export function SongAnalyzer({
  blend,
  onBlend,
  lyrics,
  onLyrics,
  onOpenBlender,
  onOpenLyrics,
}: {
  blend: BlendSlice;
  onBlend: (next: BlendSlice) => void;
  lyrics: LyricSlice;
  onLyrics: (next: LyricSlice) => void;
  onOpenBlender: () => void;
  onOpenLyrics: () => void;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const { analysis, fileName, busy, error, analyze } = useSongAnalysis();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const build = async () => {
    if (!analysis) return;
    if (!title.trim() && !description.trim()) {
      setBuildError("Add the song's name, or describe what you hear. Measurements alone can't tell the genre or instruments.");
      return;
    }
    setBuildError(null);
    setBuilding(true);
    try {
      const res = await forge({
        data: {
          task: "song",
          routing,
          apiKey,
          payload: {
            title: title.trim(),
            artist: artist.trim(),
            description: description.trim(),
            promptFormat: blend.promptFormat ?? "tags",
            measured: measuredForPrompt(analysis),
          },
        },
      });
      const result = JSON.parse(res.json) as BlendResult;
      onBlend({
        ...blend,
        lookupMode: "song",
        songTitle: title.trim() || `Analyzed: ${fileName}`,
        artists: [artist.trim(), "", ""],
        sliders: {
          energy: result.recommendedSliders?.energy ?? blend.sliders.energy,
          complexity: result.recommendedSliders?.complexity ?? blend.sliders.complexity,
          brightness: result.recommendedSliders?.brightness ?? blend.sliders.brightness,
        },
        result,
      });
      track("start_choice", "analyzer_prompt", { once: true });
      toast.success("Prompt built from your song. It's in the Band Blender.");
      onOpenBlender();
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Couldn't build the prompt.");
    } finally {
      setBuilding(false);
    }
  };

  const useStructure = () => {
    if (!analysis) return;
    onLyrics({ ...lyrics, structure: structureFromSections(analysis.sections) });
    toast.success("Structure sent to Lyric Forge's length planner.");
    onOpenLyrics();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title="Analyze a Song"
        subtitle="Drop a song you love. Get its tempo, key, sections and tone, then a Suno prompt in that style."
      >
        <div className="space-y-4">
          <SongDrop onFile={(f) => void analyze(f)} busy={busy} />
          {error ? <ErrorNote message={error} /> : null}
          {analysis ? <SongMeasurements analysis={analysis} fileName={fileName} /> : null}
        </div>
      </Panel>

      <Panel
        title="Turn it into a Suno prompt"
        subtitle="Measurements give the numbers. Tell us the song, or what you hear, for the genre and instruments."
      >
        {!analysis ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Analyze a song first. Only the measurements are sent to the AI, never the audio.
          </p>
        ) : (
          <div className="space-y-4">
            {buildError ? <ErrorNote message={buildError} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Song name (if you know it)</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Teardrop" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium">Artist</span>
                <Input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={120} placeholder="optional" />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">What do you hear?</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={800}
                rows={3}
                placeholder="e.g. moody trip-hop, breathy female vocal, harpsichord loop, heavy slow drums"
              />
              <span className="block text-[11px] text-muted-foreground">
                Needed if you don't know the song. Helps either way: genre, instruments, vocals, mood.
              </span>
            </label>
            <Button onClick={() => void build()} disabled={building} className="glow-primary w-full gap-2">
              {building ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {building ? "Building the prompt…" : "Build a Suno prompt in this style"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              The prompt opens in the Band Blender, where you can refine it, rate the take and fix it. Real artist
              and song names are kept out of the prompt.
            </p>

            {analysis.sections.length > 1 ? (
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <p className="text-sm font-medium">Write lyrics to the same structure</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sends the {analysis.sections.length} sections and their bar counts to Lyric Forge, so the lyrics fit
                  the shape of this song.
                </p>
                <Button variant="outline" size="sm" onClick={useStructure} className="mt-2 gap-1.5 text-xs">
                  <ListOrdered className="size-3.5" /> Use this structure in Lyric Forge
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
