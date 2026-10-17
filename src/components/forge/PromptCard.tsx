/**
 * PromptCard — renders a shareable style card and handles export as PNG or text.
 *
 * Used for:
 *  - Per-blend cheat sheet (standalone card with all the production info)
 *  - Prompt card builder (user's personal prompts formatted as a shareable image)
 *  - Session export trigger
 */
import { useRef, useState } from "react";
import { Camera, Clipboard, Download, FileText, Globe, Share2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { BlendResult } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitPublicPrompt } from "@/lib/community.functions";
import { vocalString } from "@/lib/suno";
import { cn } from "@/lib/utils";

export type PromptCardData = {
  artists: string[];
  genre?: string;
  targetGenre?: string;
  result: BlendResult;
  /** Optional user note / title for the card */
  cardTitle?: string;
};

type Props = {
  data: PromptCardData;
  onClose: () => void;
  /** If provided, shows a "Share link" button */
  shareSlug?: string | undefined;
  onShare?: () => Promise<void>;
  sharing?: boolean;
  /** When true, renders as a page block instead of a fixed modal overlay. */
  inline?: boolean;
};

export function PromptCard({ data, onClose, shareSlug, onShare, sharing, inline }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [communityTitle, setCommunityTitle] = useState(
    data.artists.filter(Boolean).join(" × ") || "My blend",
  );
  const [communitySubmitting, setCommunitySubmitting] = useState(false);
  const [communityDone, setCommunityDone] = useState(false);
  const submitCommunity = useServerFn(submitPublicPrompt);

  const { artists, result, cardTitle, targetGenre } = data;
  const vocal = vocalString(result.vocalPrompt);

  // ── Text export ────────────────────────────────────────────────────────────
  const textContent = [
    cardTitle ?? `${artists.filter(Boolean).join(" × ")} — Style Card`,
    "",
    result.genre ? `Genre: ${result.genre}` : "",
    result.tempo ? `Tempo: ${result.tempo}` : "",
    result.instrumentation ? `Instrumentation: ${result.instrumentation}` : "",
    result.vocals ? `Vocals: ${result.vocals}` : "",
    result.mood ? `Mood: ${result.mood}` : "",
    "",
    result.styleTag ? `Style tag:\n${result.styleTag}` : "",
    vocal ? `Vocal style:\n${vocal}` : "",
    result.excludeStyles ? `Exclude:\n${result.excludeStyles}` : "",
    "",
    result.reconciliation ? `Blend notes:\n${result.reconciliation}` : "",
    "",
    result.recommendedSliders
      ? `Sliders — Energy: ${result.recommendedSliders.energy ?? "—"} / Complexity: ${result.recommendedSliders.complexity ?? "—"} / Brightness: ${result.recommendedSliders.brightness ?? "—"}`
      : "",
    result.sliderNotes ? result.sliderNotes : "",
  ]
    .filter((l) => l !== undefined && l !== "")
    .join("\n");

  const handleCopyText = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(textContent);
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([textContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${artists.filter(Boolean).join("-").toLowerCase().replace(/\s+/g, "-") || "blend"}-style-card.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── PNG export via canvas ──────────────────────────────────────────────────
  const handleExportPng = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      // Dynamically import html2canvas — it's heavy and only needed here.
      const { default: html2canvas } = await import("html2canvas-pro"); // -pro supports oklch colors
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0d0d12",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.download = `${artists.filter(Boolean).join("-").toLowerCase().replace(/\s+/g, "-") || "blend"}-prompt-card.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      // html2canvas not installed or failed — fall back to text download
      handleDownloadText();
    } finally {
      setExporting(false);
    }
  };

  const shareUrl = shareSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/blend/${shareSlug}`
    : null;

  const inner = (
    <div className={cn("flex w-full max-w-2xl flex-col gap-3", inline && "mx-auto")}>
        {/* Actions toolbar */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2",
            !inline &&
              "sticky top-0 z-10 rounded-xl border border-border bg-background/95 p-2 backdrop-blur",
          )}
        >
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Prompt card
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={handleCopyText} className="gap-1.5 text-xs">
              <Clipboard className="size-3" />
              {copying ? "Copied!" : "Copy text"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadText} className="gap-1.5 text-xs">
              <FileText className="size-3" /> Download .txt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPng}
              disabled={exporting}
              className="gap-1.5 text-xs"
            >
              <Camera className="size-3" />
              {exporting ? "Exporting…" : "Save as image"}
            </Button>
            {onShare && !shareSlug && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                disabled={sharing}
                className="gap-1.5 border-primary/50 bg-primary/10 text-xs hover:bg-primary/20"
              >
                <Share2 className="size-3" />
                {sharing ? "Sharing…" : "Get share link"}
              </Button>
            )}
            {!communityDone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommunityForm((v) => !v)}
                className="gap-1.5 border-accent/50 bg-accent/10 text-xs text-accent hover:bg-accent/20"
              >
                <Globe className="size-3" />
                {showCommunityForm ? "Cancel" : "Submit to community"}
              </Button>
            )}
            {communityDone && (
              <span className="font-mono text-[10px] text-accent">✓ Shared to community</span>
            )}
            {shareUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                }}
                className="gap-1.5 border-accent/50 bg-accent/10 text-xs text-accent hover:bg-accent/20"
              >
                <Clipboard className="size-3" /> Copy link
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Community submit form */}
        {showCommunityForm && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <p className="mb-3 font-mono text-[10px] tracking-widest text-accent/80 uppercase">
              Share to community prompt library
            </p>
            <div className="flex gap-2">
              <Input
                value={communityTitle}
                onChange={(e) => setCommunityTitle(e.target.value)}
                placeholder="Card title…"
                className="h-8 border-border bg-card/60 text-xs"
              />
              <Button
                size="sm"
                disabled={communitySubmitting || !communityTitle.trim()}
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={async () => {
                  if (!data.result.styleTag) return;
                  setCommunitySubmitting(true);
                  try {
                    await submitCommunity({
                      data: {
                        title: communityTitle.trim(),
                        style_tag: data.result.styleTag,
                        vocal_prompt: cleanVocalPrompt(data.result.vocalPrompt),
                        exclude_styles: data.result.excludeStyles || undefined,
                        artists: data.artists.filter(Boolean),
                        genre_tags: data.targetGenre ? [data.targetGenre] : [],
                      },
                    });
                    setCommunityDone(true);
                    setShowCommunityForm(false);
                    toast.success("Shared to the community library.");
                  } catch (e) {
                    // Leave the form open so they can retry, but say why it failed.
                    toast.error(
                      e instanceof Error && e.message
                        ? e.message
                        : "Could not submit to the community. Try again.",
                    );
                  } finally {
                    setCommunitySubmitting(false);
                  }
                }}
              >
                {communitySubmitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Your style tag and vocal prompt will be visible to all users.
            </p>
          </div>
        )}

        {/* The card itself */}
        <div
          ref={cardRef}
          className="rounded-xl border border-white/10 bg-[#0d0d12] p-6 text-white shadow-2xl"
          style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
        >
          {/* Header */}
          <div className="mb-5 border-b border-white/10 pb-4">
            <div className="mb-1 font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">
              Band Blender Forge · Style Card
            </div>
            <h2 className="text-xl font-semibold leading-tight text-white">
              {cardTitle ?? (artists.filter(Boolean).join(" × ") || "Custom Blend")}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {targetGenre && (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] text-primary">
                  {targetGenre}
                </span>
              )}
              {result.genre && (
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-white/70">
                  {result.genre}
                </span>
              )}
              {result.tempo && (
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-white/70">
                  {result.tempo}
                </span>
              )}
            </div>
          </div>

          {/* Style tag — the main thing */}
          {result.styleTag && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                Suno style prompt
              </div>
              <p className="font-mono text-sm leading-relaxed text-white/90">{result.styleTag}</p>
            </div>
          )}

          {/* Two-col details */}
          <div className="mb-4 grid gap-2 text-xs sm:grid-cols-2">
            {result.instrumentation && (
              <CardField label="Instrumentation" value={result.instrumentation} />
            )}
            {result.vocals && <CardField label="Vocals" value={result.vocals} />}
            {result.mood && <CardField label="Mood" value={result.mood} />}
            {vocal && <CardField label="Vocal style" value={vocal} />}
          </div>

          {/* Exclude */}
          {result.excludeStyles && (
            <div className="mb-4">
              <CardField label="Exclude from Suno" value={result.excludeStyles} mono />
            </div>
          )}

          {/* Sliders */}
          {result.recommendedSliders && (
            <div className="mb-4 flex gap-4">
              {(
                [
                  ["Energy", result.recommendedSliders.energy],
                  ["Complexity", result.recommendedSliders.complexity],
                  ["Brightness", result.recommendedSliders.brightness],
                ] as [string, number | undefined][]
              ).map(([label, val]) => (
                <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${val ?? 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reconciliation note */}
          {result.reconciliation && (
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <div className="mb-1 font-mono text-[9px] tracking-widest text-white/30 uppercase">
                Blend logic
              </div>
              <p className="text-[11px] leading-relaxed text-white/60">{result.reconciliation}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 border-t border-white/8 pt-3 font-mono text-[9px] text-white/20">
            suno-blender.lovable.app
          </div>
        </div>
    </div>
  );

  if (inline) return inner;

  return (
    // The overlay itself scrolls, so a card taller than the window is never clipped.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:py-8">
        {inner}
      </div>
    </div>
  );
}

/** The community validator only accepts string values; drop empty or non-string fields. */
function cleanVocalPrompt(vp: BlendResult["vocalPrompt"]): Record<string, string> | undefined {
  if (!vp) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vp)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function CardField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-white/8 bg-white/3 p-2">
      <div className="mb-0.5 font-mono text-[9px] tracking-widest text-white/30 uppercase">
        {label}
      </div>
      <p className={cn("text-[11px] leading-relaxed text-white/75", mono && "font-mono")}>{value}</p>
    </div>
  );
}
