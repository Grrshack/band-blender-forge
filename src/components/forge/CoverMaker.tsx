import { AlertTriangle, CheckCircle2, Download, ExternalLink, ImagePlus, KeyRound, Loader2, Palette, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import { useSettings } from "./settings";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { COVER_LOOKS, COVER_SIZE, SHARP_MIN, coverCrop, coverPrompt, lintCoverText } from "@/lib/cover";
import { CoverAiError, generateCoverImage } from "@/lib/cover-ai";
import { FONT_STACKS, renderCover, setLastCover, type CoverFont, type CoverOptions } from "@/lib/cover-render";
import { isGeminiKey } from "@/lib/provider";
import { cn } from "@/lib/utils";

const PREVIEW = 560;

const SWATCHES = ["#1d1d1b", "#efe9dd", "#c8553d", "#2f4858", "#86836d", "#f2c14e"];

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0]!)} aria-label={label} />
    </label>
  );
}

/** A store-ready square cover: your image or a plain texture, natural finishing, your title on top. */
export function CoverMaker({
  state,
  patch,
}: {
  state: ForgeState;
  patch: <K extends keyof ForgeState>(key: K, value: ForgeState[K]) => void;
}) {
  const [img, setImg] = useState<{ el: HTMLImageElement; w: number; h: number; name: string; ai?: boolean } | null>(null);
  const [mode, setMode] = useState<"ai" | "upload" | "color">("ai");
  const { apiKey, openKeyDialog } = useSettings();
  const googleKey = apiKey.trim() && isGeminiKey(apiKey.trim()) ? apiKey.trim() : "";
  const [scene, setScene] = useState(state.lyrics.theme || "");
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<CoverAiError | null>(null);
  const [made, setMade] = useState<Array<{ url: string; model: string }>>([]);
  const [o, setO] = useState<Omit<CoverOptions, "image" | "imageW" | "imageH">>({
    background: "#efe9dd",
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    grain: 18,
    fade: 12,
    warmth: 6,
    saturation: 90,
    vignette: 20,
    title: state.lyrics.title || "",
    artist: state.release?.artist ?? "",
    font: "serif",
    textSize: 9,
    textPos: "bottom",
    align: "left",
    textColor: "#1d1d1b",
    upper: false,
  });
  const set = (p: Partial<typeof o>) => setO((prev) => ({ ...prev, ...p }));
  const [look, setLook] = useState(COVER_LOOKS[0]!.id);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const full: CoverOptions = { ...o, image: img?.el ?? null, imageW: img?.w ?? 0, imageH: img?.h ?? 0 };

  // Album Planner can open this with the album's title.
  useEffect(() => {
    try {
      const t = sessionStorage.getItem("bb.coverTitle");
      if (t) {
        sessionStorage.removeItem("bb.coverTitle");
        set({ title: t });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (canvas.current) renderCover(canvas.current, full, PREVIEW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, img]);

  const showImage = (url: string, name: string, ai = false) => {
    const el = new Image();
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight, name, ai });
    el.src = url;
  };
  const load = (file: File) => showImage(URL.createObjectURL(file), file.name);

  const issues = lintCoverText([o.title, o.artist]);
  const cropPx = img ? Math.round(coverCrop(img.w, img.h, o.zoom).size) : null;
  const soft = cropPx !== null && cropPx < SHARP_MIN;
  const builtPrompt = useMemo(() => {
    const l = COVER_LOOKS.find((x) => x.id === look) ?? COVER_LOOKS[0]!;
    return coverPrompt(l, {
      title: o.title || state.lyrics.title,
      theme: scene,
      mood: state.blend.result?.mood,
      genre: state.blend.result?.genre,
    });
  }, [look, scene, o.title, state.lyrics.title, state.blend.result]);
  const prompt = customPrompt ?? builtPrompt;

  const generate = async () => {
    if (!googleKey) return;
    setGenerating(true);
    setGenError(null);
    try {
      const r = await generateCoverImage(googleKey, prompt);
      const url = URL.createObjectURL(r.blob);
      setMade((m) => [{ url, model: r.model }, ...m].slice(0, 6));
      showImage(url, "AI image", true);
      // AI artwork has to be declared; pre-fill Release Check if it isn't answered yet.
      if (!state.release?.disclosure?.artwork) {
        patch("release", { ...state.release, disclosure: { ...state.release?.disclosure, artwork: "mostly" } });
      }
    } catch (e) {
      setGenError(e instanceof CoverAiError ? e : new CoverAiError(e instanceof Error ? e.message : "The image failed.", "other"));
    } finally {
      setGenerating(false);
    }
  };

  const exportCover = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    try {
      const c = document.createElement("canvas");
      renderCover(c, full, COVER_SIZE);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Export failed"))), "image/jpeg", 0.92));
      const name = `${(o.title || "cover").replace(/[^\w\- ]+/g, "").trim() || "cover"}-3000.jpg`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      setLastCover(URL.createObjectURL(blob));
      patch("release", {
        ...state.release,
        artist: o.artist,
        cover: { at: new Date().toISOString(), size: COVER_SIZE, title: o.title, artist: o.artist },
      });
      setDone(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <Panel title="Cover Maker" subtitle="A 3000×3000 cover stores accept: your image, a natural finish, your title. Made in your browser.">
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">1. Art</h3>
              <div role="radiogroup" aria-label="Where the art comes from" className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["ai", "Make with AI", Sparkles],
                    ["upload", "Upload", Upload],
                    ["color", "Plain color", Palette],
                  ] as const
                ).map(([m, label, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m);
                      if (m === "color") setImg(null);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs",
                      mode === m ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
              </div>

              {mode === "ai" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {COVER_LOOKS.filter((l) => l.style).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setLook(l.id);
                          setCustomPrompt(null);
                        }}
                        className={cn("rounded-lg border px-3 py-1.5 text-xs", look === l.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{COVER_LOOKS.find((l) => l.id === look)?.note}</p>
                  <div>
                    <label htmlFor="cover-scene" className="mb-1.5 block text-xs text-muted-foreground">
                      What should it show?
                    </label>
                    <Textarea
                      id="cover-scene"
                      value={scene}
                      onChange={(e) => {
                        setScene(e.target.value);
                        setCustomPrompt(null);
                      }}
                      rows={2}
                      placeholder="e.g. an empty diner at dawn seen through a rainy window"
                      className="text-sm"
                    />
                  </div>
                  <details className="rounded-lg border border-border">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium">See or edit the full prompt</summary>
                    <div className="space-y-2 px-3 pb-3">
                      <Textarea value={prompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={5} className="text-xs" aria-label="Full image prompt" />
                      {customPrompt !== null ? (
                        <button type="button" onClick={() => setCustomPrompt(null)} className="text-xs text-primary underline underline-offset-2">
                          Reset to the built prompt
                        </button>
                      ) : null}
                    </div>
                  </details>

                  {googleKey ? (
                    <Button onClick={() => void generate()} disabled={generating} className="glow-primary w-full gap-2">
                      {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {generating ? "Making the image (10–30 seconds)…" : made.length ? "Make another" : "Make the image"}
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                      <p>
                        Images are made with Google&apos;s Gemini, on your own Google key.
                        {apiKey.trim() ? " Your current key is from Anthropic, and Claude can't make images." : ""}
                      </p>
                      <Button size="sm" onClick={openKeyDialog} className="gap-1.5">
                        <KeyRound className="size-3.5" /> {apiKey.trim() ? "Switch to a Google key" : "Add a free Google key"}
                      </Button>
                    </div>
                  )}

                  {genError ? (
                    <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {genError.message}
                    </p>
                  ) : null}

                  {made.length > 1 ? (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">Your images this session. Tap one to use it.</p>
                      <div className="flex flex-wrap gap-2">
                        {made.map((m, i) => (
                          <button
                            key={m.url}
                            type="button"
                            onClick={() => showImage(m.url, "AI image", true)}
                            className={cn("size-16 overflow-hidden rounded-md border", img?.el.src === m.url ? "ring-2 ring-primary" : "border-border")}
                            aria-label={`Use image ${i + 1}`}
                          >
                            <img src={m.url} alt="" className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!googleKey || genError ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>No key? It&apos;s free in the Gemini app: copy the prompt, make the image there, then Upload it here.</span>
                      <CopyButton value={prompt} label="Copy prompt" />
                      <a
                        href="https://gemini.google.com/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                      >
                        Open Gemini <ExternalLink className="size-3" />
                      </a>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    AI images count as AI artwork; Release Check is updated so you declare it.
                  </p>
                </div>
              ) : null}

              {mode === "upload" ? (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) load(f);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                    <ImagePlus className="size-4" /> {img && !img.ai ? "Choose a different image" : "Choose a photo or artwork"}
                  </Button>
                  <p className="text-xs text-muted-foreground">A photo you took, or art made in another app. Square or larger than 3000px looks best.</p>
                </div>
              ) : null}

              {mode === "color" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">A type-only cover on a plain textured color. Classic, and nothing to generate.</p>
                  <div className="flex flex-wrap gap-2">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Background ${c}`}
                        onClick={() => set({ background: c, textColor: ["#efe9dd", "#f2c14e"].includes(c) ? "#1d1d1b" : "#efe9dd" })}
                        className={cn("size-8 rounded-md border", o.background === c ? "ring-2 ring-primary" : "border-border")}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {img ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      Using: {img.name} · {img.w}×{img.h}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setImg(null)} className="h-8 gap-1.5 text-xs">
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Range label="Zoom" value={o.zoom} min={1} max={3} step={0.05} onChange={(v) => set({ zoom: v })} />
                    <Range label="Left / right" value={o.offsetX} min={-1} max={1} step={0.02} onChange={(v) => set({ offsetX: v })} />
                    <Range label="Up / down" value={o.offsetY} min={-1} max={1} step={0.02} onChange={(v) => set({ offsetY: v })} />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">2. Natural finish</h3>
              <p className="text-xs text-muted-foreground">Grain, softer blacks and a little warmth take the plastic shine off AI images.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Range label="Film grain" value={o.grain} min={0} max={100} onChange={(v) => set({ grain: v })} />
                <Range label="Faded blacks" value={o.fade} min={0} max={100} onChange={(v) => set({ fade: v })} />
                <Range label="Warmth" value={o.warmth} min={-50} max={50} onChange={(v) => set({ warmth: v })} />
                <Range label="Color" value={o.saturation} min={0} max={150} onChange={(v) => set({ saturation: v })} />
                <Range label="Vignette" value={o.vignette} min={0} max={100} onChange={(v) => set({ vignette: v })} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">3. Title</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={o.title} onChange={(e) => set({ title: e.target.value })} placeholder="Song or album title" aria-label="Title" />
                <Input value={o.artist} onChange={(e) => set({ artist: e.target.value })} placeholder="Artist name" aria-label="Artist" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FONT_STACKS) as CoverFont[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set({ font: f })}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs", o.font === f ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
                    style={{ fontFamily: FONT_STACKS[f].stack }}
                  >
                    {FONT_STACKS[f].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => set({ upper: !o.upper })}
                  className={cn("rounded-lg border px-3 py-1.5 text-xs", o.upper ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
                >
                  ALL CAPS
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(["top", "center", "bottom"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => set({ textPos: p })} className={cn("rounded-lg border px-3 py-1.5 capitalize", o.textPos === p ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}>
                    {p}
                  </button>
                ))}
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} type="button" onClick={() => set({ align: a })} className={cn("rounded-lg border px-3 py-1.5 capitalize", o.align === a ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}>
                    {a}
                  </button>
                ))}
                <label className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1">
                  Text color
                  <input type="color" value={o.textColor} onChange={(e) => set({ textColor: e.target.value })} className="size-6 cursor-pointer bg-transparent" />
                </label>
              </div>
              <Range label="Title size" value={o.textSize} min={4} max={20} step={0.5} onChange={(v) => set({ textSize: v })} />
            </section>
          </div>
        </Panel>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start">
          <canvas ref={canvas} className="aspect-square w-full rounded-lg border border-border shadow-lg" aria-label="Cover preview" />
          <ul className="space-y-1.5 text-xs">
            {[...issues.map((t) => ({ ok: false, t })), ...(soft
                ? [
                    {
                      ok: false,
                      t: img?.ai
                        ? `AI images come out at ${cropPx}px, so this is enlarged to 3000px and may look a little soft. Film grain helps hide it.`
                        : `The image is only ${cropPx}px across at this zoom, so it will look soft at 3000px. Use a bigger image or zoom out.`,
                    },
                  ]
                : [])].map((x, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {x.t}
              </li>
            ))}
            {!issues.length && !soft ? (
              <li className="flex items-center gap-1.5 text-signal-high">
                <CheckCircle2 className="size-3.5" /> Square, 3000×3000, no links or logos.
              </li>
            ) : null}
          </ul>
          <Button onClick={() => void exportCover()} disabled={exporting} className="glow-primary w-full gap-2">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download 3000×3000 JPG
          </Button>
          {done ? <p className="text-xs text-signal-high">Saved. The song page and Release Check now show the cover as done.</p> : null}
        </div>
      </div>

    </div>
  );
}
