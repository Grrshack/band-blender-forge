import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { ErrorNote } from "./Field";
import type { BlendSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyProfile,
  deleteLocalProfile,
  listLocalProfiles,
  parseProfile,
  profileFromBlend,
  saveLocalProfile,
  type ProfileRow,
} from "@/lib/sound-profiles";
import { createPreset, deletePreset, listPresets } from "@/lib/workspace.functions";

/**
 * Named, reusable sounds: the style prompt plus the blend settings that made it.
 * Signed in → kept in your account. Signed out → kept in this browser.
 */
export function SoundProfiles({
  blend,
  onBlend,
  suggestedName = "",
  hideList = false,
  onSaved,
}: {
  blend: BlendSlice;
  onBlend: (next: BlendSlice) => void;
  /** Pre-fills the name box (e.g. from the artists). */
  suggestedName?: string;
  /** Only show the save row (used in the Band Blender's take check). */
  hideList?: boolean;
  onSaved?: () => void;
}) {
  const { session } = useAuth();
  const load = useServerFn(listPresets);
  const add = useServerFn(createPreset);
  const remove = useServerFn(deletePreset);

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setRows(listLocalProfiles());
      return;
    }
    try {
      const all = (await load()) as Array<ProfileRow & { kind: string }>;
      setRows(all.filter((r) => r.kind === "profile"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your sounds.");
    }
  }, [session, load]);

  useEffect(() => {
    void refresh();
  }, [refresh, session?.user.id]);

  const body = profileFromBlend(blend);
  const canSave = Boolean(body) && name.trim().length > 0;

  const save = async () => {
    if (!body || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (session) {
        const row = (await add({
          data: { title: name.trim(), body: JSON.stringify(body), kind: "profile", tags: [] },
        })) as ProfileRow;
        setRows((r) => [...r, row]);
      } else {
        const row = saveLocalProfile(name, body);
        if (!row) throw new Error("This browser wouldn't save it (storage may be full). Delete an old sound, or sign in.");
        setRows((r) => [...r, row]);
      }
      setName("");
      toast.success(session ? "Sound saved to your account." : "Sound saved in this browser.");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the sound.");
    } finally {
      setBusy(false);
    }
  };

  const use = (row: ProfileRow) => {
    const p = parseProfile(row.body);
    if (!p) {
      setError("That sound is damaged and can't be loaded.");
      return;
    }
    onBlend(applyProfile(blend, p));
    toast.success(`Loaded “${row.title}”.`);
  };

  const drop = async (id: string) => {
    try {
      if (session) await remove({ data: { id } });
      else deleteLocalProfile(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that sound.");
    }
  };

  const saveRow = (
    <div className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder="Name this sound, e.g. “Dusty alto trip-hop”"
        aria-label="Sound name"
        className="h-9 border-border bg-card/60 text-sm focus-visible:ring-primary"
      />
      <Button
        type="button"
        size="sm"
        disabled={!canSave || busy}
        onClick={() => void save()}
        className="h-9 shrink-0 gap-1.5 text-xs"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        Save sound
      </Button>
    </div>
  );

  if (hideList) {
    return (
      <div className="space-y-2">
        {error ? <ErrorNote message={error} /> : null}
        {saveRow}
        <p className="text-[11px] text-muted-foreground">
          {session
            ? "Saved to your account. Load it any time from Sound profiles in the Export Sheet."
            : "Saved in this browser. Sign in to keep it across devices. Load it from Sound profiles in the Export Sheet."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <UserRound className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Sound profiles
        </span>
        <span className="text-[10px] text-muted-foreground">
          {session ? "in your account" : "in this browser"}
        </span>
      </div>
      <div className="space-y-3">
        {error ? <ErrorNote message={error} /> : null}
        {saveRow}
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
                  title="Delete sound"
                  aria-label={`Delete ${r.title}`}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No saved sounds yet. Get a style you like, name it, and save it here.
            {session ? "" : " Sign in to keep them across devices."}
          </p>
        )}
      </div>
    </div>
  );
}
