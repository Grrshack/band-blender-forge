import { AlertTriangle, CheckCircle2, Download, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { Panel } from "./Field";
import type { ForgeState } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { COVER_LOOKS, COVER_SIZE, SHARP_MIN, coverCrop, coverPrompt, lintCoverText } from "@/lib/cover";
import { FONT_STACKS, renderCover, setLastCover, type CoverFont, type CoverOptions } from "@/lib/cover-render";
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
  const [img, setImg] = useState<{ el: HTMLImageElement; w: number; h: number; name: string } | null>(null);
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

  const load = (file: File) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight, name: file.name });
    el.src = url;
  };

  const issues = lintCoverText([o.title, o.artist]);
  const cropPx = img ? Math.round(coverCrop(img.w, img.h, o.zoom).size) : null;
  const soft = cropPx !== null && cropPx < SHARP_MIN;
  const prompt = useMemo(() => {
    const l = COVER_LOOKS.find((x) => x.id === look)!;
    return coverPrompt(l, {
      title: state.lyrics.title,
      theme: state.lyrics.theme,
      mood: state.blend.result?.mood,
      genre: state.blend.result?.genre,
    });
  }, [look, state.lyrics.title, state.lyrics.theme, state.blend.result]);

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
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1. Image</h3>
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
              {img ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {img.name} · {img.w}×{img.h}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setImg(null)} className="h-8 gap-1.5 text-xs">
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <ImagePlus className="size-4" /> Choose a photo or artwork
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Or skip it for a type-only cover on a plain textured color:</p>
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
              {img ? (
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <Range label="Zoom" value={o.zoom} min={1} max={3} step={0.05} onChange={(v) => set({ zoom: v })} />
                  <Range label="Left / right" value={o.offsetX} min={-1} max={1} step={0.02} onChange={(v) => set({ offsetX: v })} />
                  <Range label="Up / down" value={o.offsetY} min={-1} max={1} step={0.02} onChange={(v) => set({ offsetY: v })} />
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
            {[...issues.map((t) => ({ ok: false, t })), ...(soft ? [{ ok: false, t: `The image is only ${cropPx}px across at this zoom, so it will look soft at 3000px. Use a bigger image or zoom out.` }] : [])].map((x, i) => (
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

      <Panel
        title="Need art? Prompts that don't look like AI"
        subtitle="Paste into any image tool (Gemini, ChatGPT, Midjourney…), ask for a square image with no text, then bring it back here for the title."
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {COVER_LOOKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLook(l.id)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs", look === l.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border")}
            >
              {l.name}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">{COVER_LOOKS.find((l) => l.id === look)!.note}</p>
        {prompt ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card/40 p-3">
            <p className="flex-1 text-sm">{prompt}</p>
            <CopyButton value={prompt} size="icon" />
          </div>
        ) : (
          <p className="text-sm">Pick a background color above and add your title. Nothing to generate.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          If AI made the image, say so in Release Check: stores ask about artwork too.
        </p>
      </Panel>
    </div>
  );
}
