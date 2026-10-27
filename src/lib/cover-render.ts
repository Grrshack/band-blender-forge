/**
 * Draws a cover onto a canvas: the image (or a plain textured color), "natural look" finishing
 * (grain, faded blacks, warmth, saturation, vignette) and the title. The same function draws
 * the small preview and the full 3000×3000 export, so what you see is what you get.
 */
import { coverCrop } from "@/lib/cover";

export type CoverFont = "serif" | "sans" | "mono" | "condensed";

export const FONT_STACKS: Record<CoverFont, { label: string; stack: string; weight: number }> = {
  serif: { label: "Serif", stack: 'Georgia, "Times New Roman", serif', weight: 400 },
  sans: { label: "Sans", stack: '"Helvetica Neue", Arial, sans-serif', weight: 700 },
  mono: { label: "Typewriter", stack: '"Courier New", Courier, monospace', weight: 700 },
  condensed: { label: "Condensed", stack: '"Arial Narrow", "Roboto Condensed", Impact, sans-serif', weight: 700 },
};

export type CoverOptions = {
  image: CanvasImageSource | null;
  imageW: number;
  imageH: number;
  background: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  /** 0–100 each. */
  grain: number;
  fade: number;
  warmth: number; // -50..50
  saturation: number; // 0..150, 100 = unchanged
  vignette: number;
  title: string;
  artist: string;
  font: CoverFont;
  textSize: number; // % of cover width for the title
  textPos: "top" | "center" | "bottom";
  align: "left" | "center" | "right";
  textColor: string;
  upper: boolean;
};

// A fixed-seed random generator so grain looks the same in the preview and the export.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function renderCover(canvas: HTMLCanvasElement, o: CoverOptions, size: number): void {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, size, size);
  if (o.image && o.imageW && o.imageH) {
    const c = coverCrop(o.imageW, o.imageH, o.zoom, o.offsetX, o.offsetY);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(o.image, c.sx, c.sy, c.size, c.size, 0, 0, size, size);
  }

  // Pixel finishing. Grain scales with size so the preview matches the export's look.
  if (o.grain || o.fade || o.warmth || o.saturation !== 100 || o.vignette) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    const rand = rng(7);
    const grainAmt = (o.grain / 100) * 42;
    const lift = (o.fade / 100) * 46;
    const warm = (o.warmth / 50) * 18;
    const sat = o.saturation / 100;
    const vig = o.vignette / 100;
    const half = size / 2;
    for (let y = 0; y < size; y++) {
      const dy = (y - half) / half;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        let r = d[i]!;
        let g = d[i + 1]!;
        let b = d[i + 2]!;
        if (sat !== 1) {
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          r = l + (r - l) * sat;
          g = l + (g - l) * sat;
          b = l + (b - l) * sat;
        }
        if (warm) {
          r += warm;
          b -= warm;
        }
        if (lift) {
          // Faded blacks, like matte film: lift the darks, leave the lights.
          r = lift + r * (1 - lift / 255);
          g = lift + g * (1 - lift / 255);
          b = lift + b * (1 - lift / 255);
        }
        if (vig) {
          const dx = (x - half) / half;
          const k = 1 - vig * 0.55 * Math.min(1, Math.max(0, (dx * dx + dy * dy - 0.35) / 1.1));
          r *= k;
          g *= k;
          b *= k;
        }
        if (grainAmt) {
          const n = (rand() - 0.5) * grainAmt;
          r += n;
          g += n;
          b += n;
        }
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Title and artist.
  const font = FONT_STACKS[o.font];
  const margin = size * 0.07;
  const titleText = o.upper ? o.title.toUpperCase() : o.title;
  const artistText = o.upper ? o.artist.toUpperCase() : o.artist;
  const titlePx = Math.round(size * (o.textSize / 100));
  const artistPx = Math.round(titlePx * 0.45);
  ctx.fillStyle = o.textColor;
  ctx.textAlign = o.align;
  ctx.textBaseline = "alphabetic";
  const x = o.align === "left" ? margin : o.align === "right" ? size - margin : size / 2;
  const lines = wrap(ctx, titleText, `${font.weight} ${titlePx}px ${font.stack}`, size - margin * 2);
  const blockH = lines.length * titlePx * 1.05 + (artistText ? artistPx * 1.6 : 0);
  let y = o.textPos === "top" ? margin + titlePx : o.textPos === "center" ? (size - blockH) / 2 + titlePx : size - margin - blockH + titlePx;
  ctx.font = `${font.weight} ${titlePx}px ${font.stack}`;
  for (const line of lines) {
    if (line) ctx.fillText(line, x, y);
    y += titlePx * 1.05;
  }
  if (artistText) {
    ctx.font = `400 ${artistPx}px ${font.stack}`;
    ctx.fillText(artistText, x, y - titlePx * 1.05 + artistPx * 1.6);
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, max: number): string[] {
  if (!text.trim()) return [];
  ctx.font = font;
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}

/** The last exported cover in this tab, so Promo Clips can use it as a background. */
let lastCover: string | null = null;
export const setLastCover = (url: string) => {
  if (lastCover) URL.revokeObjectURL(lastCover);
  lastCover = url;
};
export const getLastCover = () => lastCover;
