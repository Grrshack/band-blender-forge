/**
 * Spotify Canvas: the short silent loop that plays behind a track in Spotify's Now Playing view.
 * Spotify's guidelines: 3-8 seconds, vertical 9:16, MP4 (or a JPG still), keep key content away
 * from the edges, and skip the title and artist name (Spotify already shows them).
 * Everything here renders in the browser from the cover; nothing is uploaded.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
export const CANVAS_MIN_S = 3;
export const CANVAS_MAX_S = 8;

export type CanvasLook = "drift" | "pulse" | "shine";

export const CANVAS_LOOKS: Array<{ id: CanvasLook; label: string; hint: string }> = [
  { id: "drift", label: "Drift", hint: "Slow float and zoom. Works for any genre." },
  { id: "pulse", label: "Pulse", hint: "The cover breathes on the beat. Best with a song loaded." },
  { id: "shine", label: "Shine", hint: "A soft light sweeps across the cover." },
];

/**
 * Loop length in seconds. With a tempo, a whole number of bars (4 beats) between 3 and 8 s,
 * closest to 6 s, so a beat-synced pulse loops without a jump. Without one, 6 s.
 */
export function loopSeconds(bpm?: number | null): number {
  if (!bpm || !Number.isFinite(bpm) || bpm < 40 || bpm > 240) return 6;
  const bar = (4 * 60) / bpm;
  let best = 0;
  for (let bars = 1; bars <= 8; bars++) {
    const s = bars * bar;
    if (s < CANVAS_MIN_S - 1e-9 || s > CANVAS_MAX_S + 1e-9) continue;
    if (!best || Math.abs(s - 6) < Math.abs(best - 6)) best = s;
  }
  // Very slow songs: one bar can be longer than 8 s; use beats instead.
  if (!best) {
    const beat = 60 / bpm;
    const beats = Math.max(1, Math.floor(CANVAS_MAX_S / beat));
    best = beats * beat;
  }
  return Math.round(best * 1000) / 1000;
}

/** Beat-synced swell: 1 on the beat, falling away before the next one. Periodic in `beat`. */
export function beatPulse(t: number, beat: number): number {
  const phase = (((t % beat) + beat) % beat) / beat;
  return Math.exp(-5 * phase);
}

type Sprites = { bg: HTMLCanvasElement; front: HTMLCanvasElement; pad: number };
const spriteCache = new WeakMap<object, Sprites>();
const FRONT = 860;

/**
 * The expensive parts (the big blur and the cover's drop shadow) drawn once per cover, so each
 * frame only moves finished images and recording stays smooth on ordinary laptops.
 */
/** The centre square of any image, so a non-square upload is cropped, never squashed. */
function squareSource(cover: CanvasImageSource): HTMLCanvasElement {
  const src = cover as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal?: { value: number } }; height?: number | { baseVal?: { value: number } } };
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const w = num(src.naturalWidth) || num(src.width) || 1;
  const h = num(src.naturalHeight) || num(src.height) || 1;
  const side = Math.min(w, h);
  const out = document.createElement("canvas");
  out.width = Math.min(side, 2048);
  out.height = out.width;
  out.getContext("2d")!.drawImage(cover, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out.width, out.height);
  return out;
}

function sprites(input: CanvasImageSource): Sprites {
  const hit = spriteCache.get(input as object);
  if (hit) return hit;
  const cover = squareSource(input);
  const bg = document.createElement("canvas");
  bg.width = 720;
  bg.height = 720;
  const b = bg.getContext("2d")!;
  b.filter = "blur(24px) brightness(0.5) saturate(1.25)";
  b.drawImage(cover, -60, -60, 840, 840);
  const pad = 120;
  const front = document.createElement("canvas");
  front.width = FRONT + pad * 2;
  front.height = FRONT + pad * 2;
  const f = front.getContext("2d")!;
  f.shadowColor = "rgba(0,0,0,0.55)";
  f.shadowBlur = 70;
  f.drawImage(cover, pad, pad, FRONT, FRONT);
  const out = { bg, front, pad };
  spriteCache.set(input as object, out);
  return out;
}

/** Draws one frame; periodic in `loop`, so frame 0 and frame `loop` are identical. */
export function drawCanvasFrame(
  ctx: CanvasRenderingContext2D,
  cover: CanvasImageSource,
  look: CanvasLook,
  t: number,
  loop: number,
  bpm?: number | null,
) {
  const W = CANVAS_W;
  const H = CANVAS_H;
  const a = (2 * Math.PI * t) / loop;
  const beat = bpm && bpm >= 40 && bpm <= 240 ? 60 / bpm : loop / 8;
  const sp = sprites(cover);
  ctx.save();
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, W, H);

  // Blurred cover behind everything, drifting opposite the front.
  const bgScale = 1.25 + 0.04 * Math.sin(a);
  const bg = H * bgScale;
  ctx.drawImage(sp.bg, (W - bg) / 2 - 40 * Math.sin(a), (H - bg) / 2 - 30 * Math.cos(a), bg, bg);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, W, H);

  // Front cover, kept inside the safe middle of the frame.
  let k = 1;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  if (look === "drift") {
    k = 1.04 + 0.04 * Math.sin(a);
    dx = 26 * Math.sin(a);
    dy = 18 * Math.sin(2 * a);
    rot = 0.012 * Math.sin(a);
  } else if (look === "pulse") {
    k = 1 + 0.035 * beatPulse(t, beat);
  } else {
    k = 1.02 + 0.015 * Math.sin(a);
  }
  const size = FRONT * k;
  const full = (FRONT + sp.pad * 2) * k;
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.rotate(rot);
  ctx.drawImage(sp.front, -full / 2, -full / 2, full, full);

  if (look === "shine") {
    // A diagonal band of light crossing once per loop, clipped to the cover.
    ctx.beginPath();
    ctx.rect(-size / 2, -size / 2, size, size);
    ctx.clip();
    const pos = -size * 1.5 + ((t % loop) / loop) * size * 3;
    const g = ctx.createLinearGradient(pos - 160, pos - 160, pos + 160, pos + 160);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-size / 2, -size / 2, size, size);
  } else if (look === "pulse") {
    ctx.fillStyle = `rgba(255,255,255,${0.06 * beatPulse(t, beat)})`;
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

/** Video-only formats, MP4 first because that's what Spotify takes. */
export function canvasVideoFormat(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  // MP4 only with H.264: some browsers accept "video/mp4" but put VP9 inside, which Spotify may reject.
  const options: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4;codecs=avc1.4D401F", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of options) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/** Records one loop in real time (it takes as long as the loop). */
export async function renderSpotifyCanvas(opts: {
  cover: CanvasImageSource;
  look: CanvasLook;
  bpm?: number | null;
  onProgress?: (fraction: number) => void;
}): Promise<{ blob: Blob; ext: "mp4" | "webm"; seconds: number }> {
  const fmt = canvasVideoFormat();
  if (!fmt) throw new Error("This browser can't record video. Try Chrome, Edge or Safari on a computer.");
  const loop = loopSeconds(opts.bpm);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  drawCanvasFrame(ctx, opts.cover, opts.look, 0, loop, opts.bpm);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  const started = new Promise<void>((r) => (rec.onstart = () => r()));
  rec.start(250);
  // Start the clock only once the recorder is running, so the file is the full loop.
  await started;
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawCanvasFrame(ctx, opts.cover, opts.look, Math.min(t, loop), loop, opts.bpm);
      opts.onProgress?.(Math.min(1, t / loop));
      if (t < loop) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  // The last frame equals the first; hold it a moment so the recorder catches it.
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  return { blob: new Blob(chunks, { type: fmt.mime.split(";")[0] ?? fmt.mime }), ext: fmt.ext, seconds: loop };
}

/** A still frame as JPG, which Spotify also accepts for Canvas. */
export async function spotifyCanvasStill(cover: CanvasImageSource, look: CanvasLook): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  drawCanvasFrame(canvas.getContext("2d")!, cover, look, 0, 6);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't make the image."))), "image/jpeg", 0.92));
}
