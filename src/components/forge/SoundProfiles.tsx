import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { ErrorNote } from "./Field";
import type { BlendResult, BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPreset, deletePreset, listPresets } from "@/lib/workspace.functions";

type Row = { id: string; title: string; body: string; kind: string };
type Body = {
  v: 1;
  styleTag: string;
  excludeStyles: string;
  vocalPrompt?: BlendResult["vocalPrompt"];
};

const parse = (body: string): Body | null => {
  try {
    const p = JSON.parse(body) as Partial<Body>;
    if (p.v !== 1 || typeof p.styleTag !== "string" || typeof p.excludeStyles !== "string")
      return null;
    return p as Body;
  } catch {
    return null;
  }
};

/** Named, reusable sound setups (style + exclude + vocal), kept in your account. */
export function SoundProfiles({
  blend,
  onBlend,
}: {
  blend: BlendSlice;
  onBlend: (next: BlendSlice) => void;
}) {
  const { session } = useAuth();
  const load = useServerFn(listPresets);
  const add = useServerFn(createPreset);
  const remove = useServerFn(deletePreset);

  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const all = (await load()) as Row[];
      setRows(all.filter((r) => r.kind === "profile"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your profiles.");
    }
  }, [session, load]);

  useEffect(() => {
    void refresh();
  }, [refresh, session?.user.id]);

  const result = blend.result;
  const canSave = Boolean(result?.styleTag?.trim()) && name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const body: Body = {
        v: 1,
        styleTag: result?.styleTag ?? "",
        excludeStyles: result?.excludeStyles ?? "",
        ...(result?.vocalPrompt ? { vocalPrompt: result.vocalPrompt } : {}),
      };
      const row = (await add({
        data: { title: name.trim(), body: JSON.stringify(body), kind: "profile", tags: [] },
      })) as Row;
      setRows((r) => [...r, row]);
      setName("");
      toast.success("Sound profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the profile.");
    } finally {
      setBusy(false);
    }
  };

  const use = (row: Row) => {
    const b = parse(row.body);
    if (!b) {
      setError("That profile is damaged and can't be loaded.");
      return;
    }
    onBlend({
      ...blend,
      result: {
        ...(result ?? {}),
        styleTag: b.styleTag,
        excludeStyles: b.excludeStyles,
        ...(b.vocalPrompt ? { vocalPrompt: b.vocalPrompt } : {}),
      },
    });
    toast.success(`Loaded “${row.title}”.`);
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that profile.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <UserRound className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Sound profiles
        </span>
      </div>
      {!session ? (
        <p className="text-[11px] text-muted-foreground">
          Sign in to save a style as a named profile and reuse it across songs.
        </p>
      ) : (
        <div className="space-y-3">
          {error ? <ErrorNote message={error} /> : null}
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Name this sound, e.g. “Dusty alto trip-hop”"
              className="h-9 border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
            <Button
              type="button"
              size="sm"
              disabled={!canSave || busy}
              onClick={() => void save()}
              className="h-9 gap-1.5 text-xs"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save current
            </Button>
          </div>
          {rows.length ? (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => use(r)}
                    className="h-7 text-xs"
                  >
                    Load
                  </Button>
                  <button
                    type="button"
                    onClick={() => void drop(r.id)}
                    title="Delete profile"
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No profiles yet. Get a style you like, name it, and save it here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
