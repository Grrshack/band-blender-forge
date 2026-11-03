import { useServerFn } from "@tanstack/react-start";
import { Disc3, Download, ExternalLink, Globe, Loader2, Pause, Play, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CopyButton } from "./CopyButton";
import { ErrorNote, FoldSummary, Panel } from "./Field";
import { useForge } from "./use-forge";
import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadAlbums, saveAlbums } from "@/lib/album";
import { submitPublicPrompt } from "@/lib/community.functions";
import {
  albumZipFiles,
  genreTags,
  loadProjects,
  lyricsPayload,
  plannerAlbum,
  projectFromPlan,
  saveProjects,
  sectionsFrom,
  trackSongName,
  trackState,
  type AlbumProject,
  type ProducedTrack,
} from "@/lib/lab";
import { packSlug } from "@/lib/song-pack";
import { composeSunoLyrics } from "@/lib/suno";
import { createWorkspace, saveWorkspace } from "@/lib/workspace.functions";
import { buildZip } from "@/lib/zip";
import { cn } from "@/lib/utils";

const SIZES = [
  { n: 4, label: "EP, 4 tracks" },
  { n: 5, label: "EP, 5 tracks" },
  { n: 6, label: "EP, 6 tracks" },
  { n: 8, label: "Album, 8 tracks" },
  { n: 10, label: "Album, 10 tracks" },
  { n: 12, label: "Album, 12 tracks" },
];

const looksLikeDailyLimit = (m: string) => /per day|daily|quota|resource has been exhausted|RESOURCE_EXHAUSTED/i.test(m);

/** Asks the open song menu (WorkspaceBar) to open a saved song. */
export function openSavedSong(id: string) {
  window.dispatchEvent(new CustomEvent("bb:open-song", { detail: { id } }));
}

/**
 * Admin only: plan a whole EP or album in one call, then write each track's lyrics one call
 * at a time from this browser (so nothing hits the server's time limit). Each finished track
 * is saved to My Songs and linked in Album Planner. If the key runs out of requests, it pauses
 * and picks up where it left off.
 */
export function AlbumProducer({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const forge = useForge();
  const { apiKey } = useSettings();
  const create = useServerFn(createWorkspace);
  const save = useServerFn(saveWorkspace);
  const share = useServerFn(submitPublicPrompt);

  const [projects, setProjects] = useState<AlbumProject[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [concept, setConcept] = useState("");
  const [artists, setArtists] = useState(["", "", ""]);
  const [artistName, setArtistName] = useState("");
  const [size, setSize] = useState(5);
  const [planning, setPlanning] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pauseRef = useRef(false);
  const projectsRef = useRef<AlbumProject[]>([]);

  useEffect(() => {
    const list = loadProjects();
    projectsRef.current = list;
    setProjects(list);
    setCurrentId(list[0]?.id ?? null);
  }, []);

  /** Keeps a ref in step so the long write loop always sees the latest project. */
  const commit = (next: AlbumProject[]) => {
    projectsRef.current = next;
    setProjects(next);
    saveProjects(next);
  };
  const updateProject = (id: string, fn: (p: AlbumProject) => AlbumProject) =>
    commit(projectsRef.current.map((p) => (p.id === id ? fn(p) : p)));
  const updateTrack = (id: string, n: number, patch: Partial<ProducedTrack>) =>
    updateProject(id, (p) => ({ ...p, tracks: p.tracks.map((t) => (t.n === n ? { ...t, ...patch } : t)) }));

  const project = projects.find((p) => p.id === currentId) ?? null;

  const plan = async (surprise = false) => {
    setError(null);
    setPlanning(true);
    try {
      const names = artists.map((a) => a.trim()).filter(Boolean);
      const res = await forge({
        data: {
          task: "albumPlan",
          routing: "fast",
          apiKey,
          payload: {
            concept: surprise ? "Surprise me: pick an original, specific concept and sound." : concept.trim(),
            artists: names,
            artistName: artistName.trim(),
            trackCount: size,
            sunoVersion: "v6",
          },
        },
      });
      const p = projectFromPlan(JSON.parse(res.json) as Record<string, unknown>, {
        concept: surprise ? "Surprise me" : concept.trim(),
        artists: names,
        artistName: artistName.trim(),
      });
      if (!p.tracks.length) throw new Error("The AI didn't return any tracks. Try again.");
      commit([p, ...projectsRef.current]);
      setCurrentId(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't plan the record.");
    } finally {
      setPlanning(false);
    }
  };

  /** Mirrors the record into Album Planner, linked to the saved songs. */
  const syncPlanner = (p: AlbumProject) => {
    const albums = loadAlbums();
    const existing = albums.find((a) => a.id === (p.plannerId ?? p.id));
    const album = plannerAlbum(p, existing);
    saveAlbums(existing ? albums.map((a) => (a.id === album.id ? album : a)) : [album, ...albums]);
    if (!p.plannerId) updateProject(p.id, (x) => ({ ...x, plannerId: album.id }));
  };

  const writeTrack = async (projectId: string, n: number) => {
    const p = projectsRef.current.find((x) => x.id === projectId);
    const t = p?.tracks.find((x) => x.n === n);
    if (!p || !t) return;
    updateTrack(projectId, n, { status: "writing", error: undefined });
    const res = await forge({ data: { task: "lyrics", routing: "fast", apiKey, payload: lyricsPayload(p, t) } });
    const out = JSON.parse(res.json) as { title?: string; sections?: Array<{ tag?: string; cue?: string; lines?: string[] }> };
    const sections = sectionsFrom(out);
    if (!sections.length) throw new Error("The AI didn't return any lyrics.");
    const lyricTitle = (out.title ?? "").trim() || t.title;
    const written: ProducedTrack = { ...t, lyricTitle, sections, status: "done" };
    const fresh = projectsRef.current.find((x) => x.id === projectId) ?? p;
    const state = trackState(fresh, written);
    const name = trackSongName(fresh, written);
    let songId = t.songId;
    if (songId) await save({ data: { id: songId, name, state } });
    else songId = ((await create({ data: { name, state } })) as { id: string }).id;
    updateTrack(projectId, n, { lyricTitle, sections, status: "done", songId });
    syncPlanner(projectsRef.current.find((x) => x.id === projectId)!);
  };

  const writeAll = async () => {
    if (!project) return;
    const id = project.id;
    setError(null);
    setWriting(true);
    pauseRef.current = false;
    for (const t of project.tracks) {
      if (pauseRef.current) break;
      const now = projectsRef.current.find((x) => x.id === id)?.tracks.find((x) => x.n === t.n);
      if (!now || now.status === "done") continue;
      try {
        await writeTrack(id, t.n);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't write this track.";
        updateTrack(id, t.n, { status: "failed", error: msg });
        setError(
          looksLikeDailyLimit(msg)
            ? "Your AI key looks out of requests for today. Everything written so far is saved; press Continue tomorrow, or switch to a key with billing on."
            : `Stopped at track ${t.n}: ${msg} Press Continue to try again.`,
        );
        break;
      }
    }
    setWriting(false);
  };

  const redoOne = async (n: number) => {
    if (!project) return;
    setError(null);
    setWriting(true);
    try {
      await writeTrack(project.id, n);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't write this track.";
      updateTrack(project.id, n, { status: "failed", error: msg });
    } finally {
      setWriting(false);
    }
  };

  const downloadZip = () => {
    if (!project) return;
    const bytes = buildZip(albumZipFiles(project).map(([name, data]) => ({ name, data })));
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${packSlug(project.title)}-album.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const publishTrack = async (t: ProducedTrack) => {
    if (!project) return;
    try {
      await share({
        data: {
          title: `${t.lyricTitle || t.title}`.slice(0, 80),
          style_tag: t.styleTag.slice(0, 1000),
          ...(project.excludeStyles ? { exclude_styles: project.excludeStyles } : {}),
          artists: project.artists,
          genre_tags: genreTags(project.sharedSound.split(",")[0] ?? ""),
        },
      });
      toast.success(`"${t.lyricTitle || t.title}" is in the community library.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't publish it.");
    }
  };

  const open = (t: ProducedTrack) => {
    if (!t.songId) return;
    openSavedSong(t.songId);
    onGoTab("lyrics");
  };

  const left = project ? project.tracks.filter((t) => t.status !== "done").length : 0;
  const doneCount = project ? project.tracks.length - left : 0;

  return (
    <Panel
      title="Album Producer"
      subtitle="Plan a whole EP or album, then write every track's style and lyrics. Finished tracks are saved to My Songs and linked in Album Planner. Only you can see this."
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-medium">Concept</span>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="e.g. 90s shoegaze haze with heavy alt-metal low end, about leaving a small town"
            />
          </label>
          <div className="space-y-1">
            <span className="block text-xs font-medium">Influences (optional, never named in the prompts)</span>
            <div className="flex gap-1.5">
              {artists.map((a, i) => (
                <Input
                  key={i}
                  value={a}
                  onChange={(e) => setArtists(artists.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Artist ${i + 1}`}
                  maxLength={80}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex-1 space-y-1">
              <span className="block text-xs font-medium">Act name</span>
              <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="optional" maxLength={80} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium">Size</span>
              <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                {SIZES.map((s) => (
                  <option key={s.n} value={s.n}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void plan(false)} disabled={planning || writing || concept.trim().length < 4} className="glow-primary gap-1.5">
            {planning ? <Loader2 className="size-4 animate-spin" /> : <Disc3 className="size-4" />} Plan it
          </Button>
          <Button variant="outline" onClick={() => void plan(true)} disabled={planning || writing} className="gap-1.5">
            <Sparkles className="size-4" /> Surprise me
          </Button>
          <span className="self-center text-[11px] text-muted-foreground">
            One call plans the record; then one call per track. A {size}-track record is about {size + 1} calls.
          </span>
        </div>
        {error ? <ErrorNote message={error} /> : null}

        {projects.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentId(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  p.id === currentId ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.title}
              </button>
            ))}
          </div>
        ) : null}

        {project ? (
          <section aria-label={project.title} className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={project.title}
                  onChange={(e) => updateProject(project.id, (p) => ({ ...p, title: e.target.value.slice(0, 60) }))}
                  className="font-display text-base font-semibold"
                  aria-label="Record title"
                />
                {project.summary ? <p className="mt-1 text-xs text-muted-foreground">{project.summary}</p> : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                aria-label="Delete this record"
                disabled={writing}
                onClick={() => {
                  if (!window.confirm(`Delete "${project.title}" from the producer? Songs already saved stay in My Songs.`)) return;
                  const next = projectsRef.current.filter((p) => p.id !== project.id);
                  commit(next);
                  setCurrentId(next[0]?.id ?? null);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="rounded border border-primary/20 bg-primary/5 p-2">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Shared sound</p>
              <p className="font-mono text-xs">{project.sharedSound}</p>
              {project.excludeStyles ? <p className="mt-1 font-mono text-[10px] text-muted-foreground">Keep out: {project.excludeStyles}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {writing ? (
                <Button variant="outline" onClick={() => (pauseRef.current = true)} className="gap-1.5">
                  <Pause className="size-4" /> Pause after this track
                </Button>
              ) : left ? (
                <Button onClick={() => void writeAll()} className="gap-1.5">
                  <Play className="size-4" /> {doneCount ? `Continue (${left} left)` : `Write all ${left} tracks`}
                </Button>
              ) : null}
              <Button variant="outline" onClick={downloadZip} disabled={!doneCount} className="gap-1.5">
                <Download className="size-4" /> Album (.zip)
              </Button>
              <span className="text-xs text-muted-foreground">
                {doneCount} of {project.tracks.length} written
              </span>
            </div>

            <ol className="space-y-2">
              {project.tracks.map((t) => (
                <li key={t.n} className="rounded-lg border border-border bg-background/40">
                  <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{String(t.n).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {t.lyricTitle || t.title}
                      {t.role ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t.role}</span> : null}
                      {t.bpm ? <span className="ml-2 font-mono text-[10px] text-muted-foreground">{t.bpm} BPM</span> : null}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px]",
                        t.status === "done" && "bg-signal-high/15 text-signal-high",
                        t.status === "writing" && "bg-primary/15 text-primary",
                        t.status === "failed" && "bg-destructive/15 text-destructive",
                        t.status === "planned" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {t.status === "writing" ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="size-3 animate-spin" /> writing
                        </span>
                      ) : t.status === "done" ? (
                        "saved"
                      ) : (
                        t.status
                      )}
                    </span>
                  </div>
                  <p className="px-3 pt-1 text-xs text-muted-foreground">
                    {t.theme}
                    {t.twist ? <span className="text-foreground/70"> · {t.twist}</span> : null}
                  </p>
                  {t.error ? <p className="px-3 pt-1 text-xs text-destructive">{t.error}</p> : null}
                  <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-2.5">
                    {t.songId ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => open(t)}>
                        <ExternalLink className="size-3" /> Open in studio
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={writing} onClick={() => void redoOne(t.n)}>
                      <RotateCw className="size-3" /> {t.status === "done" ? "Rewrite lyrics" : "Write this one"}
                    </Button>
                    <CopyButton value={t.styleTag} label="Copy style" />
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => void publishTrack(t)}>
                      <Globe className="size-3" /> Publish style to library
                    </Button>
                  </div>
                  <details className="group border-t border-border">
                    <FoldSummary className="py-2 text-xs">{t.sections?.length ? "Style and lyrics" : "Style"}</FoldSummary>
                    <div className="space-y-2 px-3 pb-3">
                      <Textarea
                        value={t.styleTag}
                        onChange={(e) => updateTrack(project.id, t.n, { styleTag: e.target.value.slice(0, 1000) })}
                        rows={3}
                        className="font-mono text-xs"
                        aria-label={`Style for track ${t.n}`}
                      />
                      {t.sections?.length ? (
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border bg-card/60 p-2 font-mono text-[11px] leading-relaxed">
                          {composeSunoLyrics(t.sections)}
                        </pre>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-muted-foreground">
              Records are kept in this browser; the finished songs are saved to your account under My Songs as &quot;{project.title} — 01 …&quot;.
            </p>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}
