import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import type { CompareResult, CompareSlice } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";

export function ComparableArtists({
  value,
  onChange,
}: {
  value: CompareSlice;
  onChange: (next: CompareSlice) => void;
}) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lyrics, tags, result } = value;

  const run = async () => {
    if (!lyrics.trim() && !tags.trim()) {
      setError("Paste lyrics or style tags first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: { task: "compare", routing, apiKey, payload: { lyrics, styleTags: tags } },
      });
      onChange({ ...value, result: JSON.parse(res.json) as CompareResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const plain = (result?.artists ?? [])
    .map((a) => `${a.name}\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`)
    .join("\n\n");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Panel title="Reverse Lookup" subtitle="Paste your lyrics and/or style tags.">
        {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
        <div className="space-y-4">
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Your lyrics
            </span>
            <Textarea
              value={lyrics}
              onChange={(e) => onChange({ ...value, lyrics: e.target.value })}
              rows={10}
              placeholder={"Paste a verse or chorus here…"}
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Style tags
            </span>
            <Textarea
              value={tags}
              onChange={(e) => onChange({ ...value, tags: e.target.value })}
              rows={3}
              placeholder="dark synthwave, 104 bpm, breathy female vocal, analog tape…"
              className="resize-y border-border bg-card/60 font-mono text-sm focus-visible:ring-primary"
            />
          </div>
          <Button
            onClick={() => void run()}
            disabled={loading}
            className="glow-primary h-11 w-full gap-2 font-display tracking-wide"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Matching tone against real catalogues…" : "Find Comparable Artists"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Comparable Artists"
        subtitle={result?.summary ?? "Real-world reference points with reasoning."}
        action={plain ? <CopyButton value={plain} label="Copy all" /> : undefined}
      >
        {result?.artists?.length ? (
          <div className="space-y-3">
            {result.artists.map((a, i) => (
              <article
                key={i}
                className="rounded-lg border border-border bg-card/70 p-4 transition-colors hover:border-accent/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-foreground">{a.name}</h3>
                  <div className="flex items-center gap-2">
                    {typeof a.match === "number" ? (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                        {a.match}% match
                      </span>
                    ) : null}
                    <CopyButton
                      value={`${a.name}\n${(a.reasoning ?? []).map((r) => `- ${r}`).join("\n")}`}
                      size="icon"
                    />
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {(a.reasoning ?? []).map((r, j) => (
                    <li key={j} className="flex gap-2 text-sm text-foreground/85">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 text-center">
            <Search className="size-8 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Results appear here: three to four real artists with a bulleted reasoning breakdown.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
