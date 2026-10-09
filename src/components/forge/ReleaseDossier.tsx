import { useServerFn } from "@tanstack/react-start";
import { Disc3, Loader2, Rocket } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel, ReadoutField } from "./Field";
import { useSettings } from "./settings";
import type { BlendSlice, DossierResult, LyricSlice } from "./types";
import { Button } from "@/components/ui/button";
import { runForge } from "@/lib/forge.functions";
import { composeSunoLyrics } from "@/lib/suno";

function dossierText(d: DossierResult): string {
  const m = d.metadata ?? {};
  return [
    `TITLE OPTIONS\n${(d.titleOptions ?? []).join("\n")}`,
    `COVER ART\n${d.coverArtPrompt ?? ""}\n\nALT\n${d.coverArtAlt ?? ""}`,
    `METADATA\nGenre: ${m.primaryGenre ?? ""} / ${m.secondaryGenre ?? ""}\nMoods: ${(m.moods ?? []).join(", ")}\nBPM: ${m.bpm ?? ""}\nKey: ${m.key ?? ""}\nExplicit: ${m.explicit ? "yes" : "no"}\nLanguage: ${m.language ?? ""}`,
    `PITCH\n${d.shortDescription ?? ""}`,
    `BIO\n${d.bio ?? ""}`,
    `PLAYLIST PITCH\n${d.playlistPitch ?? ""}`,
    `SOCIAL HOOKS\n${(d.socialHooks ?? []).map((h) => `${h.platform}: ${h.hook} (clip: ${h.clip})`).join("\n")}`,
    `HASHTAGS\n${(d.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`,
    `RELEASE WEEK\n${(d.releaseTips ?? []).map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
  ].join("\n\n");
}

export function ReleaseDossier({
  blend,
  lyrics,
  value,
  onChange,
}: {
  blend: BlendSlice;
  lyrics: LyricSlice;
  value: DossierResult | null;
  onChange: (v: DossierResult | null) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const r = blend.result;
  const lyricText = composeSunoLyrics(lyrics.sections);
  const ready = Boolean(r?.styleTag || lyricText.trim());

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "dossier",
          routing,
          apiKey,
          payload: {
            title: lyrics.title,
            theme: lyrics.theme,
            genre: r?.genre ?? "",
            tempo: r?.tempo ?? "",
            mood: r?.mood ?? "",
            style: r?.styleTag ?? lyrics.manualStyle,
            vocals: r?.vocals ?? "",
            lyrics: lyricText.slice(0, 4000),
          },
        },
      });
      onChange(JSON.parse(res.json) as DossierResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dossier failed.");
    } finally {
      setLoading(false);
    }
  };

  const m = value?.metadata;

  return (
    <Panel
      title="Release Dossier"
      subtitle="Cover art prompts, streaming metadata, pitch copy and social hooks — one click, one AI call."
      action={value ? <CopyButton value={dossierText(value)} label="Copy all" /> : null}
    >
      {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void run()}
          disabled={!ready || loading}
          className="glow-primary h-11 gap-2 font-display tracking-wide"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {value ? "Rebuild dossier" : "Build release dossier"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {ready
            ? `Uses your blend${lyricText.trim() ? " and lyrics" : ""}${lyrics.title ? ` for "${lyrics.title}"` : ""}.`
            : "Run a blend or write lyrics first — the dossier is built from them."}
        </p>
      </div>

      {!value ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center">
          <Disc3 className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your release kit will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadoutField label="Title options" value={(value.titleOptions ?? []).join("\n")} />
          <ReadoutField label="One-line pitch" value={value.shortDescription ?? ""} />
          <ReadoutField label="Cover art prompt" value={value.coverArtPrompt ?? ""} accent />
          <ReadoutField label="Alt cover direction" value={value.coverArtAlt ?? ""} />
          <ReadoutField
            label="Streaming metadata"
            mono
            value={[
              `Genre: ${m?.primaryGenre ?? "—"}${m?.secondaryGenre ? ` / ${m.secondaryGenre}` : ""}`,
              `Moods: ${(m?.moods ?? []).join(", ")}`,
              `BPM: ${m?.bpm ?? "—"}  ·  Key: ${m?.key ?? "—"}`,
              `Explicit: ${m?.explicit ? "yes" : "no"}  ·  ${m?.language ?? ""}`,
            ].join("\n")}
          />
          <ReadoutField
            label="Hashtags"
            mono
            value={(value.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
          />
          <div className="md:col-span-2">
            <ReadoutField label="Release bio" value={value.bio ?? ""} />
          </div>
          <div className="md:col-span-2">
            <ReadoutField label="Playlist editor pitch" value={value.playlistPitch ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Social hooks
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {(value.socialHooks ?? []).map((h, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/70 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">
                      {h.platform}
                    </span>
                    <CopyButton value={h.hook ?? ""} size="icon" />
                  </div>
                  <p className="text-sm">{h.hook}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Clip: {h.clip}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <ReadoutField
              label="Release week"
              value={(value.releaseTips ?? []).map((t, i) => `${i + 1}. ${t}`).join("\n")}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}
