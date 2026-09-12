import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  Copy,
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
import { exportBrief, hasContent, mergeState, type ForgeState } from "./types";
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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled session");
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

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  // Debounced autosave of the whole workspace state. The first time a signed-in
  // user puts real work in, the session is created automatically.
  useEffect(() => {
    if (!session) return;
    if (!currentId && !hasContent(state)) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, name, currentId, session?.user.id]);

  const startNew = async (initial?: ForgeState, label?: string) => {
    if (!session) return;
    try {
      const row = (await create({
        data: { name: label ?? "Untitled session", state: initial ?? state },
      })) as Row;
      skipNext.current = true;
      setCurrentId(row.id);
      setName(row.name);
      if (initial) onLoadState(initial);
      void refresh();
      toast.success("Session created.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the session.");
    }
  };

  const open = async (id: string) => {
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
      toast.error(e instanceof Error ? e.message : "Could not open that session.");
    }
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { id } });
      if (currentId === id) {
        setCurrentId(null);
        setStatus("idle");
      }
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete that session.");
    }
  };

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
                Sessions
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[10px] tracking-[0.2em] uppercase">
                Your sessions
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {rows.length === 0 ? (
                <DropdownMenuItem disabled>No saved sessions yet</DropdownMenuItem>
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
                        void drop(r.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void startNew()}>
                <Plus className="size-3.5" /> Save current work as a new session
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void startNew(state, `${name} (copy)`)}>
                <Copy className="size-3.5" /> Duplicate current session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-44 border-border bg-card/60 text-sm"
            aria-label="Session name"
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
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Working locally — nothing is saved
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(brief);
                toast.success("Full brief copied.");
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <Copy className="size-3.5" /> Copy brief
            </Button>
            <Button asChild size="sm" className="glow-primary h-8 text-xs">
              <Link to="/auth">Sign in to save sessions</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
