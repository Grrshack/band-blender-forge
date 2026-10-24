/**
 * GenreGuide — static reference cards for common genres, plus user-created
 * custom cards stored in Supabase. Logged-in users can create, edit and
 * delete their own cards in the "My Cards" tab.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  Clipboard,
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { Panel } from "./Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth";
import {
  listCustomGenreCards,
  saveCustomGenreCard,
  deleteCustomGenreCard,
  type CustomGenreCard,
} from "@/lib/genre.functions";
import { GENRE_CARDS, USE_CASE_CARDS } from "@/lib/genre-cards";

// ── Empty form state ───────────────────────────────────────────────────────────

type CardFormState = {
  id?: string;
  name: string;
  emoji: string;
  family: string;
  bpm: string;
  feel: string;
  instrumentation: string;
  vocals: string;
  style_template: string;
  exclude: string;
  notes: string;
};

const EMPTY_FORM: CardFormState = {
  name: "",
  emoji: "🎵",
  family: "Custom",
  bpm: "",
  feel: "",
  instrumentation: "",
  vocals: "",
  style_template: "",
  exclude: "",
  notes: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GenreGuide({ onApplyToBlend }: { onApplyToBlend?: (genre: string) => void }) {
  const { session } = useAuth();
  const [view, setView] = useState<"genres" | "usecases" | "mine">("genres");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── My Cards state ────────────────────────────────────────────────────────
  const [myCards, setMyCards] = useState<CustomGenreCard[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [myCopied, setMyCopied] = useState<string | null>(null);

  // Load user's custom cards when they open the My Cards tab or log in
  const loadMyCards = useCallback(async () => {
    if (!session) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const cards = await listCustomGenreCards();
      setMyCards(cards);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not load your cards.");
    } finally {
      setMyLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (view === "mine" && session) void loadMyCards();
  }, [view, session, loadMyCards]);

  // On mount, read ?card= param and auto-expand that card.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cardId = params.get("card");
      if (cardId) {
        setExpanded(cardId);
        setTimeout(() => {
          cardRefs.current.get(cardId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    } catch {
      // URL parsing unavailable
    }
  }, []);

  const families = ["All", ...Array.from(new Set(GENRE_CARDS.map((c) => c.family)))];

  const filtered = GENRE_CARDS.filter((c) => {
    const matchFamily = family === "All" || c.family === family;
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.family.toLowerCase().includes(query.toLowerCase());
    return matchFamily && matchQuery;
  });

  const copyTag = async (id: string, tag: string) => {
    await navigator.clipboard.writeText(tag);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyMyTag = async (id: string, tag: string) => {
    await navigator.clipboard.writeText(tag);
    setMyCopied(id);
    setTimeout(() => setMyCopied(null), 1500);
  };

  const copyLink = async (cardId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=genres&card=${cardId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(cardId);
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const exportCardImage = async (cardId: string) => {
    const el = cardRefs.current.get(cardId);
    if (!el) return;
    setExporting(cardId);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(el, {
        backgroundColor: "#0d0d12",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.download = `${cardId}-genre-card.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      const card = GENRE_CARDS.find((c) => c.id === cardId);
      if (card) await navigator.clipboard.writeText(card.styleTemplate);
    } finally {
      setExporting(null);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (card: CustomGenreCard) => {
    setForm({
      id: card.id,
      name: card.name,
      emoji: card.emoji,
      family: card.family,
      bpm: card.bpm,
      feel: card.feel,
      instrumentation: card.instrumentation,
      vocals: card.vocals,
      style_template: card.style_template,
      exclude: card.exclude,
      notes: card.notes,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.style_template.trim()) return;
    setSaving(true);
    setMyError(null);
    try {
      const saved = await saveCustomGenreCard({ data: form });
      setMyCards((prev) => {
        if (form.id) {
          return prev.map((c) => (c.id === form.id ? saved : c));
        }
        return [saved, ...prev];
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not save card.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setMyError(null);
    try {
      await deleteCustomGenreCard({ data: { id } });
      setMyCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not delete card.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex rounded-lg border border-border p-0.5">
        {(["genres", "usecases", "mine"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-md py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
              view === v
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "genres" ? "Genre Cards" : v === "usecases" ? "Use Case Templates" : "My Cards"}
          </button>
        ))}
      </div>

      {/* ── Use Case Templates ── */}
      {view === "usecases" && (
        <Panel
          title="Use Case Templates"
          subtitle="Style prompts organised by what the music is for, not just how it sounds."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {USE_CASE_CARDS.map((card) => (
              <div key={card.id} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-lg">{card.emoji}</span>
                    <span className="font-semibold text-sm text-foreground">{card.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{card.description}</p>
                </div>
                <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                  <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                    Style template
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-foreground/80">{card.styleTemplate}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-border px-2 text-[10px]"
                      onClick={() => void copyTag(card.id, card.styleTemplate)}
                    >
                      <Clipboard className="size-2.5" />
                      {copied === card.id ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{card.notes}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Preset Genre Cards ── */}
      {view === "genres" && (
        <Panel
          title="Genre Reference Cards"
          subtitle="Ready-to-use Suno style templates and production notes for common genres."
        >
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search genres…"
              className="h-8 w-48 border-border bg-card/60 text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {families.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
                    family === f
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((card) => (
              <div
                key={card.id}
                ref={(el) => { if (el) cardRefs.current.set(card.id, el); else cardRefs.current.delete(card.id); }}
                className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden"
              >
                {/* Card header */}
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(expanded === card.id ? null : card.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{card.emoji}</span>
                      <span className="font-semibold text-sm text-foreground">{card.name}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {card.bpm}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{card.feel}</p>
                  </div>
                  {expanded === card.id ? (
                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Style tag — always visible */}
                <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                  <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                    Style template
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-foreground/80">{card.styleTemplate}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-border px-2 text-[10px]"
                      onClick={() => void copyTag(card.id, card.styleTemplate)}
                    >
                      <Clipboard className="size-2.5" />
                      {copied === card.id ? "Copied!" : "Copy"}
                    </Button>
                    {onApplyToBlend && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-primary/40 bg-primary/5 px-2 text-[10px] text-primary hover:bg-primary/15"
                        onClick={() => onApplyToBlend(card.name)}
                      >
                        Set as genre target →
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === card.id && (
                  <div className="border-t border-border/50 space-y-3 p-4 text-xs">
                    <Detail label="Instrumentation" value={card.instrumentation} />
                    <Detail label="Vocals" value={card.vocals} />
                    <Detail label="Exclude from Suno" value={card.exclude} mono />
                    <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                      <div className="mb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                        Suno note
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground/70">{card.notes}</p>
                    </div>
                    <div>
                      <div className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                        Example artist blends
                      </div>
                      {card.exampleBlends.map((b, i) => (
                        <div key={i} className="mb-2 last:mb-0">
                          <span className="font-medium text-foreground/90">{b.artists.join(" × ")}</span>
                          <p className="text-[11px] text-muted-foreground">{b.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Share row */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
                      <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase mr-1">
                        Share
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-border px-2 text-[10px]"
                        onClick={() => void copyLink(card.id)}
                      >
                        <Link2 className="size-2.5" />
                        {linkCopied === card.id ? "Link copied!" : "Copy link"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-border px-2 text-[10px]"
                        disabled={exporting === card.id}
                        onClick={() => void exportCardImage(card.id)}
                      >
                        <Camera className="size-2.5" />
                        {exporting === card.id ? "Exporting…" : "Save as image"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── My Cards ── */}
      {view === "mine" && (
        <Panel
          title="My Cards"
          subtitle="Your personal genre templates — save anything you use repeatedly."
        >
          {/* Not logged in */}
          {!session && (
            <div className="py-10 text-center">
              <p className="font-mono text-sm text-muted-foreground">
                Sign in to create and save your own genre cards.
              </p>
            </div>
          )}

          {session && (
            <div className="space-y-4">
              {/* Error */}
              {myError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-[11px] text-destructive">
                  {myError}
                </p>
              )}

              {/* Create / Edit Form */}
              {showForm && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] tracking-wider text-primary uppercase">
                      {form.id ? "Edit card" : "New card"}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <Input
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                        placeholder="🎵"
                        className="w-16 shrink-0 border-border bg-card/60 text-center text-lg"
                        maxLength={4}
                      />
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Card name *"
                        className="border-border bg-card/60 text-xs"
                      />
                    </div>
                    <Input
                      value={form.family}
                      onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                      placeholder="Family (e.g. Electronic)"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={form.bpm}
                      onChange={(e) => setForm((f) => ({ ...f, bpm: e.target.value }))}
                      placeholder="BPM (e.g. 120bpm)"
                      className="border-border bg-card/60 text-xs"
                    />
                    <Input
                      value={form.feel}
                      onChange={(e) => setForm((f) => ({ ...f, feel: e.target.value }))}
                      placeholder="Feel / vibe"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                      Style template *
                    </label>
                    <textarea
                      value={form.style_template}
                      onChange={(e) => setForm((f) => ({ ...f, style_template: e.target.value }))}
                      placeholder="Comma-separated Suno style tags…"
                      rows={2}
                      className="w-full rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={form.instrumentation}
                      onChange={(e) => setForm((f) => ({ ...f, instrumentation: e.target.value }))}
                      placeholder="Instrumentation"
                      className="border-border bg-card/60 text-xs"
                    />
                    <Input
                      value={form.vocals}
                      onChange={(e) => setForm((f) => ({ ...f, vocals: e.target.value }))}
                      placeholder="Vocals"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <Input
                    value={form.exclude}
                    onChange={(e) => setForm((f) => ({ ...f, exclude: e.target.value }))}
                    placeholder="Exclude from Suno (optional)"
                    className="border-border bg-card/60 text-xs"
                  />

                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Production notes (optional)"
                    rows={2}
                    className="w-full rounded-md border border-border bg-card/60 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                      className="font-mono text-[11px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={saving || !form.name.trim() || !form.style_template.trim()}
                      className="gap-1.5 font-mono text-[11px]"
                    >
                      <Save className="size-3.5" />
                      {saving ? "Saving…" : "Save card"}
                    </Button>
                  </div>
                </div>
              )}

              {/* New card button */}
              {!showForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCreateForm}
                  className="gap-1.5 border-primary/40 font-mono text-[11px] text-primary hover:bg-primary/10"
                >
                  <Plus className="size-3.5" />
                  New card
                </Button>
              )}

              {/* Loading */}
              {myLoading && (
                <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
                  Loading…
                </p>
              )}

              {/* Empty state */}
              {!myLoading && myCards.length === 0 && !showForm && (
                <div className="rounded-xl border border-border border-dashed py-10 text-center">
                  <p className="font-mono text-sm text-muted-foreground">No cards yet.</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
                    Create one to save a style template you use often.
                  </p>
                </div>
              )}

              {/* My cards list */}
              {!myLoading && myCards.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {myCards.map((card) => (
                    <div
                      key={card.id}
                      className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{card.emoji}</span>
                            <span className="font-semibold text-sm text-foreground">{card.name}</span>
                            {card.bpm && (
                              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                                {card.bpm}
                              </span>
                            )}
                          </div>
                          {card.feel && (
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{card.feel}</p>
                          )}
                        </div>
                        {/* Edit / Delete */}
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(card)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(card.id)}
                            disabled={deleting === card.id}
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Style template */}
                      <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                        <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                          Style template
                        </div>
                        <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
                          {card.style_template}
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 border-border px-2 text-[10px]"
                            onClick={() => void copyMyTag(card.id, card.style_template)}
                          >
                            <Clipboard className="size-2.5" />
                            {myCopied === card.id ? "Copied!" : "Copy"}
                          </Button>
                          {onApplyToBlend && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 border-primary/40 bg-primary/5 px-2 text-[10px] text-primary hover:bg-primary/15"
                              onClick={() => onApplyToBlend(card.name)}
                            >
                              Set as genre target →
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Optional expanded detail */}
                      {(card.instrumentation || card.vocals || card.exclude || card.notes) && (
                        <div className="border-t border-border/50 space-y-2 p-4 text-xs">
                          {card.instrumentation && <Detail label="Instrumentation" value={card.instrumentation} />}
                          {card.vocals && <Detail label="Vocals" value={card.vocals} />}
                          {card.exclude && <Detail label="Exclude from Suno" value={card.exclude} mono />}
                          {card.notes && (
                            <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                              <div className="mb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                                Notes
                              </div>
                              <p className="text-[11px] leading-relaxed text-foreground/70">{card.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
        {label}
      </div>
      <p className={cn("text-[11px] leading-relaxed text-foreground/80", mono && "font-mono")}>{value}</p>
    </div>
  );
}
