import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  Copy,
  Disc3,
  Download,
  FolderOpen,
  Loader2,
  LogOut,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { emptyState, exportBrief, hasContent, mergeState, type ForgeState } from "./types";
import {
  deleteLocalSong,
  getLocalSong,
  listLocalSongs,
  saveLocalSong,
  type LocalSong,
} from "@/lib/local-songs";
import { SongProgress } from "./SongProgress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  saveWorkspace,
} from "@/lib/workspace.functions";

type Row = { id: string; name: string; updated_at: string };

const UNTITLED = "Untitled song";

export function WorkspaceBar({
  state,
  onLoadState,
}: {
  state: ForgeState;
  onLoadState: (s: ForgeState) => void;
}) {
  const { session, email, signOut } = useAuth();
  const list = useServerFn(listWorkspaces);
  const get = useServerFn(getWorkspace);
  const create = useServerFn(createWorkspace);
  const save = useServerFn(saveWorkspace);
  const remove = useServerFn(deleteWorkspace);

  const [rows, setRows] = useState<Row[]>([]);
  const [localRows, setLocalRows] = useState<LocalSong[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState(UNTITLED);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const skipNext = useRef(true);

  const refresh = async () => {
    if (!session) return;
    try {
      setRows((await list()) as Row[]);
    } catch {
      /* listing failure is non-blocking */
    }
  };

  const refreshLocal = () => setLocalRows(listLocalSongs());

  useEffect(() => {
    void refresh();
    refreshLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  // Debounced autosave. Signed-in users save to the cloud; unsigned users save
  // to localStorage so work survives reloads.
  useEffect(() => {
    if (!hasContent(state)) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (session) {
      setStatus("saving");
      const t = setTimeout(() => {
        const op = currentId
          ? save({ data: { id: currentId, name, state } })
          : create({ data: { name, state } }).then((row) => {
              setCurrentId((row as Row).id);
            });
        op.then(() => {
          setStatus("saved");
          void refresh();
        }).catch(() => setStatus("idle"));
      }, 1200);
      return () => clearTimeout(t);
    }
    // Local autosave for unsigned users
    setStatus("saving");
    const t = setTimeout(() => {
      const song = saveLocalSong(currentId, name, state);
      setCurrentId(song.id);
      setStatus("saved");
      refreshLocal();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, name, currentId, session?.user.id]);

  const startNew = async (initial?: ForgeState, label?: string) => {
    if (session) {
      try {
        const row = (await create({
          data: { name: label ?? UNTITLED, state: initial ?? state },
        })) as Row;
        skipNext.current = true;
        setCurrentId(row.id);
        setName(row.name);
        if (initial) onLoadState(initial);
        void refresh();
        toast.success(initial ? "New song started." : "Song saved.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create the song.");
      }
      return;
    }
    // Local save for unsigned users
    skipNext.current = true;
    const song = saveLocalSong(null, label ?? UNTITLED, initial ?? state);
    setCurrentId(song.id);
    setName(song.name);
    if (initial) onLoadState(initial);
    refreshLocal();
    toast.success(initial ? "New song started." : "Song saved.");
  };

  const open = async (id: string) => {
    if (session) {
      try {
        const row = (await get({ data: { id } })) as {
          id: string;
          name: string;
          state: unknown;
        } | null;
        if (!row) return;
        skipNext.current = true;
        setCurrentId(row.id);
        setName(row.name);
        onLoadState(mergeState(row.state));
        setStatus("saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not open that song.");
      }
      return;
    }
    const song = getLocalSong(id);
    if (!song) return;
    skipNext.current = true;
    setCurrentId(song.id);
    setName(song.name);
    onLoadState(song.state);
    setStatus("saved");
  };

  const drop = async (id: string) => {
    if (session) {
      try {
        await remove({ data: { id } });
        if (currentId === id) {
          setCurrentId(null);
          setStatus("idle");
        }
        void refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete that song.");
      }
      return;
    }
    deleteLocalSong(id);
    if (currentId === id) {
      setCurrentId(null);
      setStatus("idle");
    }
    refreshLocal();
  };

  // Auto-suggest a session name when the first blend result arrives and the user hasn't renamed yet
  useEffect(() => {
    if (name !== UNTITLED && name !== "Untitled session") return;
    const { artists, lookupMode, songTitle, result } = state.blend;
    if (!result) return;
    let suggested = "";
    if (lookupMode === "song" && songTitle.trim()) {
      suggested = songTitle.trim();
    } else {
      const validArtists = artists.filter(Boolean);
      if (validArtists.length > 0) suggested = validArtists.slice(0, 2).join(" × ");
    }
    if (suggested) setName(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blend.result]);

  const brief = exportBrief(name, state);

  const download = () => {
    const blob = new Blob([brief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "brief"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel-surface flex flex-wrap items-center gap-2 px-3 py-2">
      {session ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                <FolderOpen className="size-3.5 text-primary" />
                My songs
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[10px] tracking-[0.2em] uppercase">
                Your songs
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {rows.length === 0 ? (
                <DropdownMenuItem disabled>No saved songs yet</DropdownMenuItem>
              ) : (
                rows.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      void open(r.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    {currentId === r.id ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <span className="size-3.5" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
                        void drop(r.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete song"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void startNew(emptyState(), UNTITLED)}>
                <Plus className="size-3.5" /> Start a new song
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void startNew(
                    { ...emptyState(), blend: state.blend, master: state.master },
                    `${name} (next track)`,
                  )
                }
              >
                <Disc3 className="size-3.5" /> Next track, same sound (album or EP)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void startNew(state, `${name} (copy)`)}>
                <Copy className="size-3.5" /> Duplicate this song
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-44 border-border bg-card/60 text-sm"
            aria-label="Song name"
          />

          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            {!currentId
              ? "Not saved"
              : status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved"
                  : "Ready"}
            {status === "saving" ? <Loader2 className="ml-1 inline size-3 animate-spin" /> : null}
          </span>

          <SongProgress state={state} />
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(brief);
                toast.success("Full brief copied.");
              }}
              className="h-8 gap-1.5 border-accent/40 bg-accent/10 text-xs text-accent hover:bg-accent/20"
            >
              <Copy className="size-3.5" /> Copy brief
            </Button>
            <Button variant="outline" size="sm" onClick={download} className="h-8 gap-1.5 text-xs">
              <Download className="size-3.5" /> Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                  {email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="size-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                <FolderOpen className="size-3.5 text-primary" />
                My songs
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[10px] tracking-[0.2em] uppercase">
                Your songs (saved on this device)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {localRows.length === 0 ? (
                <DropdownMenuItem disabled>No saved songs yet</DropdownMenuItem>
              ) : (
                localRows.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      void open(r.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    {currentId === r.id ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <span className="size-3.5" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
                        void drop(r.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete song"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void startNew(emptyState(), UNTITLED)}>
                <Plus className="size-3.5" /> Start a new song
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void startNew(
                    { ...emptyState(), blend: state.blend, master: state.master },
                    `${name} (next track)`,
                  )
                }
              >
                <Disc3 className="size-3.5" /> Next track, same sound (album or EP)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void startNew(state, `${name} (copy)`)}>
                <Copy className="size-3.5" /> Duplicate this song
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-44 border-border bg-card/60 text-sm"
            aria-label="Song name"
          />

          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            {!currentId
              ? "Not saved"
              : status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved"
                  : "Ready"}
            {status === "saving" ? <Loader2 className="ml-1 inline size-3 animate-spin" /> : null}
          </span>

          <SongProgress state={state} />
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(brief);
                toast.success("Full brief copied.");
              }}
              className="h-8 gap-1.5 border-accent/40 bg-accent/10 text-xs text-accent hover:bg-accent/20"
            >
              <Copy className="size-3.5" /> Copy brief
            </Button>
            <Button variant="outline" size="sm" onClick={download} className="h-8 gap-1.5 text-xs">
              <Download className="size-3.5" /> Export
            </Button>
            <Button asChild size="sm" className="glow-primary h-8 text-xs">
              <Link to="/auth">Sign in to sync</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
