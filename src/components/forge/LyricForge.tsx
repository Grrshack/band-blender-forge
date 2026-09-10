import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, LockOpen, RefreshCw, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { BlendResult } from "./BandBlender";
import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import { useSettings } from "./settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { runForge } from "@/lib/forge.functions";
import { cn } from "@/lib/utils";

type Line = { text: string; locked: boolean };
type Section = { tag: string; lines: Line[] };

function toPlain(sections: Section[], title: string) {
  const body = sections
    .map((s) => `${s.tag}\n${s.lines.map((l) => l.text).join("\n")}`)
    .join("\n\n");
  return title ? `${title}\n\n${body}` : body;
}

export function LyricForge({ blend }: { blend: BlendResult | null }) {
  const forge = useServerFn(runForge);
  const { apiKey, routing } = useSettings();

  const [theme, setTheme] = useState("");
  const [hook, setHook] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const styleContext = {
    styleTag: blend?.styleTag ?? "",
    genre: blend?.genre ?? "",
    vocals: blend?.vocals ?? "",
    mood: blend?.mood ?? "",
  };

  const generate = async () => {
    if (!theme.trim()) {
      toast.error("Describe what the song is about first.");
      return;
    }
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "lyrics",
          routing,
          apiKey,
          payload: { theme, hookIdea: hook, notes, style: styleContext },
        },
      });
      const out = JSON.parse(res.json) as {
        title?: string;
        sections?: Array<{ tag?: string; lines?: string[] }>;
      };
      setTitle(out.title ?? "");
      setSections(
        (out.sections ?? []).map((s) => ({
          tag: s.tag ?? "[Section]",
          lines: (s.lines ?? []).map((t) => ({ text: t, locked: false })),
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = (si: number, li: number) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, lines: s.lines.map((l, j) => (j === li ? { ...l, locked: !l.locked } : l)) }
          : s,
      ),
    );

  const editLine = (si: number, li: number, text: string) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i === si ? { ...s, lines: s.lines.map((l, j) => (j === li ? { ...l, text } : l)) } : s,
      ),
    );

  const regenLine = async (si: number, li: number) => {
    const section = sections[si];
    if (!section) return;
    const line = section.lines[li];
    if (!line || line.locked) return;
    const id = `${si}-${li}`;
    setBusy(id);
    try {
      const res = await forge({
        data: {
          task: "regenLine",
          routing,
          apiKey,
          payload: {
            theme,
            style: styleContext,
            sectionTag: section.tag,
            lineToRewrite: line.text,
            sectionLines: section.lines.map((l) => l.text),
          },
        },
      });
      const out = JSON.parse(res.json) as { line?: string };
      if (out.line) editLine(si, li, out.line);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Line rewrite failed.");
    } finally {
      setBusy(null);
    }
  };

  const regenSection = async (si: number) => {
    const section = sections[si];
    if (!section) return;
    const id = `s-${si}`;
    setBusy(id);
    try {
      const res = await forge({
        data: {
          task: "regenSection",
          routing,
          apiKey,
          payload: {
            theme,
            hookIdea: hook,
            notes,
            style: styleContext,
            sectionTag: section.tag,
            lines: section.lines.map((l) => ({ text: l.text, locked: l.locked })),
            otherSections: sections
              .filter((_, i) => i !== si)
              .map((s) => ({ tag: s.tag, lines: s.lines.map((l) => l.text) })),
          },
        },
      });
      const out = JSON.parse(res.json) as { lines?: string[] };
      if (out.lines?.length) {
        setSections((prev) =>
          prev.map((s, i) =>
            i === si
              ? {
                  ...s,
                  lines: s.lines.map((l, j) =>
                    l.locked ? l : { text: out.lines?.[j] ?? l.text, locked: false },
                  ),
                }
              : s,
          ),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Section rewrite failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Panel title="Lyric Brief" subtitle="Hook-first writing. No AI clichés.">
        <div className="space-y-4">
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Song subject
            </span>
            <Textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={4}
              placeholder="A night-shift nurse driving home at 6am…"
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Hook idea (optional)
            </span>
            <Input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="Something chantable…"
              className="border-border bg-card/60 focus-visible:ring-primary"
            />
          </div>
          <div>
            <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Constraints (optional)
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Short lines, present tense, no rhyme on the chorus…"
              className="resize-y border-border bg-card/60 text-sm focus-visible:ring-primary"
            />
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Linked style
            </span>
            <p className="mt-1 font-mono text-xs text-accent">
              {blend?.styleTag ?? "No blend linked — run Band Lookup to inherit a style."}
            </p>
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="h-11 w-full gap-2 font-display tracking-wide glow-violet"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {loading ? "Forging…" : "Forge Lyrics"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Lyric Sheet"
        subtitle={title || "Section tags, per-line lock and regeneration."}
        action={
          sections.length ? <CopyButton value={toPlain(sections, title)} label="Copy song" /> : undefined
        }
      >
        {sections.length ? (
          <div className="space-y-4">
            {sections.map((s, si) => (
              <div key={si} className="rounded-lg border border-border bg-card/60">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
                    {s.tag}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy === `s-${si}`}
                      onClick={() => regenSection(si)}
                      className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <RefreshCw
                        className={cn("size-3.5", busy === `s-${si}` && "animate-spin")}
                      />
                      Regenerate section
                    </Button>
                    <CopyButton
                      value={`${s.tag}\n${s.lines.map((l) => l.text).join("\n")}`}
                      size="icon"
                    />
                  </div>
                </div>
                <ul className="divide-y divide-border/60">
                  {s.lines.map((l, li) => (
                    <li
                      key={li}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-1.5 transition-colors",
                        l.locked ? "bg-primary/5" : "hover:bg-secondary/40",
                      )}
                    >
                      <input
                        value={l.text}
                        onChange={(e) => editLine(si, li, e.target.value)}
                        readOnly={l.locked}
                        className={cn(
                          "min-w-0 flex-1 bg-transparent py-1 text-sm outline-none",
                          l.locked ? "text-primary" : "text-foreground",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => toggleLock(si, li)}
                        title={l.locked ? "Unlock line" : "Lock line"}
                        className={cn(
                          "rounded p-1.5 transition-colors",
                          l.locked
                            ? "text-primary"
                            : "text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-foreground",
                        )}
                      >
                        {l.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => regenLine(si, li)}
                        disabled={l.locked || busy === `${si}-${li}`}
                        title="Regenerate line"
                        className="rounded p-1.5 text-muted-foreground opacity-60 transition-colors group-hover:opacity-100 hover:text-accent disabled:opacity-25"
                      >
                        <RefreshCw
                          className={cn("size-3.5", busy === `${si}-${li}` && "animate-spin")}
                        />
                      </button>
                      <CopyButton value={l.text} size="icon" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center">
            <Wand2 className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Lyrics arrive split into [Verse 1], [Pre-Chorus], [Chorus] and more — every line gets a
              lock toggle and a one-click rewrite.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
