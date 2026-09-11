import { useServerFn } from "@tanstack/react-start";
import { BookMarked, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPreset, deletePreset, listPresets } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

type Preset = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  kind: string;
  tags: string[];
};

const KINDS = [
  { key: "style", label: "Style" },
  { key: "lyric", label: "Lyric brief" },
  { key: "structure", label: "Structure" },
] as const;

export function PromptLibrary({
  onApply,
}: {
  onApply: (kind: string, body: string) => void;
}) {
  const { session } = useAuth();
  const load = useServerFn(listPresets);
  const add = useServerFn(createPreset);
  const remove = useServerFn(deletePreset);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newKind, setNewKind] = useState<"style" | "lyric" | "structure">("style");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setPresets((await load()) as Preset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your presets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets.filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        (!q ||
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [presets, query, kind]);

  const save = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      setError("A preset needs a title and a body.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const row = (await add({
        data: {
          title: newTitle,
          body: newBody,
          kind: newKind,
          tags: newTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
        },
      })) as Preset;
      setPresets((p) => [...p, row]);
      setNewTitle("");
      setNewBody("");
      setNewTags("");
      toast.success("Preset saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the preset.");
    } finally {
      setSaving(false);
    }
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { id } });
      setPresets((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that preset.");
    }
  };

  if (!session) {
    return (
      <Panel title="Prompt Library" subtitle="Reusable starting points for style and lyrics.">
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 text-center">
          <BookMarked className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Sign in to browse the starter presets and save your own reusable style and lyric
            prompts.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <Panel title="Save a Preset" subtitle="Anything you find yourself typing twice.">
        {error ? <ErrorNote message={error} /> : null}
        <div className="space-y-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Preset title"
            className="border-border bg-card/60"
          />
          <Textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={5}
            placeholder="The prompt text itself…"
            className="resize-y border-border bg-card/60 text-sm"
          />
          <div className="flex gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setNewKind(k.key)}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
                  newKind === k.key
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="tags, comma, separated"
            className="border-border bg-card/60 text-xs"
          />
          <Button onClick={() => void save()} disabled={saving} className="h-10 w-full gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Save preset
          </Button>
        </div>
      </Panel>

      <Panel
        title="Prompt Library"
        subtitle={`${filtered.length} preset${filtered.length === 1 ? "" : "s"}`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search presets…"
              className="border-border bg-card/60 pl-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {[{ key: "all", label: "All" }, ...KINDS].map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
                  kind === k.key
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((p) => (
              <article key={p.id} className="rounded-lg border border-border bg-card/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-foreground">{p.title}</h3>
                  <span className="shrink-0 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                    {p.kind}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApply(p.kind, p.body)}
                    className="h-7 border-primary/50 bg-primary/10 text-[11px] hover:bg-primary/20"
                  >
                    Use
                  </Button>
                  <CopyButton value={p.body} size="icon" />
                  {p.user_id ? (
                    <button
                      type="button"
                      onClick={() => void drop(p.id)}
                      title="Delete preset"
                      className="ml-auto rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <span className="ml-auto font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                      Starter
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
