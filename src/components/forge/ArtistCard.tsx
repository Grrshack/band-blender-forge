/**
 * Artist card: invents the act behind the song (name, story, lineup, look, tagline) in one AI
 * call on the person's own key, and shows it as a card they can download as an image or copy.
 * The identity is saved with the song, goes into the song pack, and Bio & Pitch writes about it.
 */
import { Check, Clipboard, Download, Loader2, Sparkles, UserRound } from "lucide-react";
import { useRef, useState } from "react";

import { ErrorNote, Panel } from "./Field";
import { useSettings } from "./settings";
import type { BlendSlice, LyricSlice } from "./types";
import { useForge } from "./use-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IDENTITY_LIMITS,
  LINEUP_LABELS,
  cardColors,
  cleanIdentity,
  identityText,
  type ArtistIdentity,
  type Lineup,
} from "@/lib/artist-identity";
import { APP_DOMAIN, APP_NAME } from "@/lib/brand";
import { markStep } from "@/lib/starter-steps";
import { track } from "@/lib/stats";
import { composeSunoLyrics } from "@/lib/suno";

const fileSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "artist";

export function ArtistCard({
  blend,
  lyrics,
  value,
  onChange,
  artistName,
  onArtistName,
}: {
  blend: BlendSlice;
  lyrics: LyricSlice;
  value: ArtistIdentity | undefined;
  onChange: (v: ArtistIdentity) => void;
  /** The artist name used on the cover and release (Cover Maker, synced lyrics). */
  artistName: string;
  onArtistName: (name: string) => void;
}) {
  const forge = useForge();
  const { apiKey, routing } = useSettings();
  const [lineup, setLineup] = useState<Lineup>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const r = blend.result;
  const lyricText = composeSunoLyrics(lyrics.sections);
  const ready = Boolean(r?.styleTag || lyricText.trim() || lyrics.manualStyle.trim());

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await forge({
        data: {
          task: "identity",
          routing,
          apiKey,
          payload: {
            lineup,
            artists: blend.artists.filter((a) => a.trim()),
            title: lyrics.title,
            theme: lyrics.theme,
            genre: r?.genre ?? blend.targetGenre ?? "",
            mood: r?.mood ?? "",
            style: r?.styleTag ?? lyrics.manualStyle,
            vocals: r?.vocals ?? "",
            lyrics: lyricText.slice(0, 1500),
            ...(value ? { avoid: `Make a different act from "${value.name}".` } : {}),
          },
        },
      });
      // The server already cleaned it; cleaning again keeps old or odd answers safe to show.
      const id = cleanIdentity(JSON.parse(res.json) as Record<string, unknown>, [], lineup);
      onChange({ ...id, at: new Date().toISOString() });
      track("identity_made", lineup);
      markStep("artist");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the artist card.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(identityText(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const download = async () => {
    if (!cardRef.current || !value) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 3, useCORS: true, logging: false });
      const a = document.createElement("a");
      a.download = `${fileSlug(value.name)}-artist-card.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      track("identity_card_png");
    } catch {
      setError("Couldn't make the image. Copy the text instead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Artist card"
      subtitle="Invent the act behind this song: a name, a short story, the lineup and a look, on a card you can share. One AI call on your key."
    >
      {error ? <ErrorNote message={error} onRetry={() => void run()} /> : null}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Lineup</span>
          <select
            aria-label="Lineup"
            value={lineup}
            onChange={(e) => setLineup(e.target.value as Lineup)}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {(Object.keys(LINEUP_LABELS) as Lineup[]).map((k) => (
              <option key={k} value={k}>
                {LINEUP_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void run()} disabled={!ready || loading} className="h-11 gap-2 font-display tracking-wide">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {value ? "Make another" : "Make my artist card"}
        </Button>
        <p className="basis-full text-xs text-muted-foreground">
          {ready
            ? "Built from your sound and lyrics. The act is invented: no real names, no made-up awards or chart places."
            : "Run a blend or write lyrics first. The act is built from them."}
        </p>
      </div>

      {!value ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your artist card will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[360px_minmax(0,1fr)]">
          <IdentityCardView ref={cardRef} identity={value} />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="identity-name" className="text-xs text-muted-foreground">
                Act name (edit it if you like)
              </label>
              <Input
                id="identity-name"
                value={value.name}
                maxLength={IDENTITY_LIMITS.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
              />
            </div>
            {value.look ? (
              <div>
                <p className="text-xs text-muted-foreground">Look, for photos and artwork</p>
                <p className="mt-1 text-sm">{value.look}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => void download()} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Download image
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => void copy()}>
                {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />} {copied ? "Copied" : "Copy text"}
              </Button>
            </div>
            {value.name.trim() && artistName.trim() !== value.name.trim() ? (
              <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                <p className="text-muted-foreground">
                  {artistName.trim() ? `Your cover and release say "${artistName.trim()}".` : "No artist name is set for the cover and release yet."}
                </p>
                <Button size="sm" variant="secondary" className="mt-2 text-xs" onClick={() => onArtistName(value.name.trim())}>
                  Use "{value.name.trim()}" as the artist name
                </Button>
              </div>
            ) : value.name.trim() ? (
              <p className="text-xs text-muted-foreground">
                <Check className="mr-1 inline size-3.5 text-emerald-400" />
                The Cover Maker and synced lyrics use this name.
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bio &amp; Pitch below writes about this act when you build or rebuild the dossier, and the song pack includes it. It's
              invented, so don't claim real achievements for it, and say it's AI-made where a distributor asks.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** The card itself: a fixed-size block (4:5) that downloads as a PNG. Plain colours only, so the image matches. */
export function IdentityCardView({ identity, ref }: { identity: ArtistIdentity; ref?: React.Ref<HTMLDivElement> }) {
  const c = cardColors(identity.palette);
  return (
    <div
      ref={ref}
      data-testid="artist-card"
      className="relative flex aspect-[4/5] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl p-6"
      style={{ background: `linear-gradient(160deg, ${c.from} 0%, ${c.to} 100%)`, color: c.text }}
    >
      <div className="absolute top-0 right-0 left-0 h-1.5" style={{ background: c.accent }} />
      <p className="text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: c.muted }}>
        {identity.genre || "New artist"}
      </p>
      <h3 className="mt-3 font-display text-[32px] leading-[1.05] font-bold break-words">{identity.name}</h3>
      {identity.tagline ? (
        <p className="mt-2 text-sm italic" style={{ color: c.muted }}>
          {identity.tagline}
        </p>
      ) : null}
      <p className="mt-4 line-clamp-6 text-[13px] leading-relaxed">{identity.story}</p>
      {identity.members.length ? (
        <ul className="mt-4 space-y-0.5 text-[12px]">
          {identity.members.map((m) => (
            <li key={m.name}>
              <span className="font-semibold">{m.name}</span>
              {m.role ? <span style={{ color: c.muted }}> · {m.role}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="flex gap-1.5" aria-hidden="true">
          {identity.palette.map((p) => (
            <span key={p} className="size-3.5 rounded-full border" style={{ background: p, borderColor: c.muted }} />
          ))}
        </div>
        <p className="text-right text-[9px] tracking-wide" style={{ color: c.muted }}>
          Made with {APP_NAME}
          <br />
          {APP_DOMAIN}
        </p>
      </div>
    </div>
  );
}
