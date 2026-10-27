import { AlertTriangle, CheckCircle2, Download, FileAudio, Loader2, MicVocal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { SaveToTake } from "./SaveToTake";
import { SongDrop } from "./SongMeasurements";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmLargeAudio } from "@/lib/audio/large-file";
import { formatTime } from "@/lib/audio/song-analysis";
import { decodeAudioFile } from "@/lib/audio/take-diagnosis";
import { SPEECH_MODELS, toWhisperInput, transcribe } from "@/lib/audio/transcribe";
import { buildLrc, checkLyrics, linesFromText, sunoEditFor, type LyricCheck as Result } from "@/lib/lyric-align";
import { composeSunoLyrics } from "@/lib/suno";
import { attachCheck } from "@/lib/takes";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  ok: "border-transparent",
  changed: "border-amber-500/50 bg-amber-500/5",
  missing: "border-destructive/50 bg-destructive/5",
} as const;

/** "Did Suno sing my lyrics?" Speech recognition in the browser, compared with what was written. */
export function LyricCheck({
  state,
  patch,
  onGoTab,
}: {
  state: ForgeState;
  patch: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
  onGoTab: (tab: string) => void;
}) {
  const forged = state.lyrics.sections.some((s) => s.lines.length);
  const [useForged, setUseForged] = useState(forged);
  const [pasted, setPasted] = useState("");
  const lyricText = useForged && forged ? composeSunoLyrics(state.lyrics.sections) : pasted;
  const lines = useMemo(() => linesFromText(lyricText), [lyricText]);

  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(SPEECH_MODELS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const title = state.lyrics.title || "Untitled";
  const artist = state.release?.artist ?? "";
  const lrc = useMemo(() => (result ? buildLrc(result.lines, { title, artist }) : ""), [result, title, artist]);

  const run = async () => {
    if (!file || !lines.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDownload(null);
    try {
      setStage("Reading the file…");
      const buffer = await decodeAudioFile(file);
      const audio = await toWhisperInput(buffer);
      const heard = await transcribe(audio, model, {
        onStage: setStage,
        onDownload: (loaded, total) => setDownload({ loaded, total }),
      });
      const r = checkLyrics(lines, heard.words);
      setResult(r);
      patch("release", { ...state.release, lrc: buildLrc(r.lines, { title, artist }), lrcAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The lyric check failed.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const saveLrc = () => {
    const blob = new Blob([lrc], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "lyrics"}.lrc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  const pct = download && download.total ? Math.round((download.loaded / download.total) * 100) : null;

  return (
    <div className="space-y-5">
      <Panel
        title="Lyric Check: did Suno sing my lyrics?"
        subtitle="Compares what the singer says with what you wrote, line by line. Runs in your browser; the song is never uploaded."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold">1. The lyrics you wrote</h3>
            {forged ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUseForged(true)}
                  className={cn("rounded-lg border px-3 py-1.5", useForged ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
                >
                  From Lyric Forge: {title}
                </button>
                <button
                  type="button"
                  onClick={() => setUseForged(false)}
                  className={cn("rounded-lg border px-3 py-1.5", !useForged ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
                >
                  Paste other lyrics
                </button>
              </div>
            ) : null}
            {useForged && forged ? (
              <p className="text-xs text-muted-foreground">{lines.length} lines, section tags and cues ignored.</p>
            ) : (
              <Textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder={"[Verse 1]\nPaste the lyrics exactly as you put them into Suno…"}
                className="resize-y border-border bg-card/60 font-mono text-xs"
              />
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold">2. The take</h3>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                <FileAudio className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-8 gap-1.5 text-xs">
                  <Trash2 className="size-3.5" /> Change
                </Button>
              </div>
            ) : (
              <SongDrop onFile={(f) => confirmLargeAudio(f) && setFile(f)} busy={false} />
            )}
            <p className="text-xs text-muted-foreground">
              Needs the audio file, so it uses a Suno download. Best for your keeper before you release it.
            </p>
            <div role="radiogroup" aria-label="Speech model" className="space-y-1.5 pt-1">
              {SPEECH_MODELS.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="speech-model"
                    checked={model === m.id}
                    onChange={() => setModel(m.id)}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    {m.label}
                    <span className="block text-xs text-muted-foreground">{m.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void run()} disabled={busy || !file || !lines.length} className="glow-primary gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MicVocal className="size-4" />}
            {busy ? stage || "Working…" : "Check the lyrics"}
          </Button>
          {busy && pct !== null && pct < 100 ? (
            <span className="text-xs text-muted-foreground">Downloading the speech model: {pct}% (one time only)</span>
          ) : null}
          {!lines.length ? <span className="text-xs text-muted-foreground">Add the lyrics first.</span> : null}
        </div>
        {error ? <div className="mt-3"><ErrorNote message={error} /></div> : null}
      </Panel>

      {result ? (
        <Panel
          title={`${result.accuracyPct}% of the words sung as written`}
          subtitle="Speech recognition is trained on speech, not singing: effects, harmonies and loud mixes can cause false flags. Listen before you edit."
        >
          {result.issues.length ? (
            <>
              <h3 className="mb-2 text-sm font-semibold">Worth a listen ({result.issues.length})</h3>
              <ul className="space-y-2">
                {result.issues.map((l, i) => {
                  const tip = sunoEditFor(l, formatTime);
                  return (
                    <li key={i} className={cn("rounded-lg border p-3", STATUS_STYLE[l.status])}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">
                          {l.status === "missing" ? "Not heard" : "Sung differently"}
                          {l.section ? <span className="text-muted-foreground"> · {l.section}</span> : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {l.start !== null ? `${formatTime(l.start)}–${formatTime(l.end ?? l.start)}` : "no time"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">Written: {l.text}</p>
                      {l.heard ? <p className="text-sm text-muted-foreground">Heard: {l.heard}</p> : null}
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-card/60 p-2 text-xs">
                        <span className="flex-1">{tip}</span>
                        <CopyButton value={tip} size="icon" />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Button variant="outline" size="sm" onClick={() => onGoTab("fix")} className="mt-3 h-8 text-xs">
                Plan the fix in Fix a Track
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-signal-high/40 bg-signal-high/10 p-3 text-sm">
              <CheckCircle2 className="size-4 text-signal-high" /> Every line was heard as written.
            </p>
          )}

          <details className="group mt-5 rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Every line with its time
            </summary>
            <ol className="space-y-1 px-3 pb-3 text-sm">
              {result.lines.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    {l.start !== null ? formatTime(l.start) : "—"}
                  </span>
                  <span className={cn(l.status === "missing" && "text-destructive", l.status === "changed" && "text-amber-300")}>
                    {l.status !== "ok" ? <AlertTriangle className="mr-1 inline size-3.5" /> : null}
                    {l.text}
                  </span>
                </li>
              ))}
            </ol>
          </details>

          <div className="mt-5 space-y-3 rounded-lg border border-border bg-card/40 p-3">
            <h3 className="text-sm font-semibold">Synced lyrics (LRC)</h3>
            <p className="text-xs text-muted-foreground">
              A time for every line, used by lyric videos and Promo Clips. Spotify and Apple show synced lyrics through
              Musixmatch, where you sync them yourself; these times are a head start.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={saveLrc} className="h-8 gap-1.5 text-xs">
                <Download className="size-3.5" /> Download .lrc
              </Button>
              <CopyButton value={lrc} label="Copy LRC" />
            </div>
          </div>

          <div className="mt-4">
            <SaveToTake
              what="Lyric Check"
              takes={state.takes}
              style={state.blend.result?.styleTag ?? ""}
              exclude={state.blend.result?.excludeStyles ?? ""}
              onSave={(takes, id) =>
                patch(
                  "takes",
                  attachCheck(takes, id, "lyric", {
                    at: new Date().toISOString(),
                    accuracyPct: result.accuracyPct,
                    issues: result.issues.slice(0, 30).map((l) => ({
                      time: l.start,
                      line: l.text,
                      heard: l.heard,
                      status: l.status === "missing" ? "missing" : "changed",
                    })),
                  }),
                )
              }
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
