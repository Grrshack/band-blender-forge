/**
 * Renders a vertical (9:16) lyric clip in the browser: the cover, the title, and each synced
 * lyric line as it's sung, recorded in real time with the audio. No upload, no server.
 */
import { encodeWav } from "@/lib/audio/mastering-dsp";
import { lineAt, type TimedLine } from "@/lib/promo";

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;

/** The best format this browser can record: MP4 where supported (Safari, recent Chrome), else WebM. */
export function videoFormat(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of options) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/** Cuts [start, end) out of a decoded song with short fades so the clip doesn't click. */
export function sliceWithFades(buffer: AudioBuffer, start: number, end: number, fade = 0.25): Float32Array[] {
  const fs = buffer.sampleRate;
  const a = Math.max(0, Math.floor(start * fs));
  const b = Math.min(buffer.length, Math.floor(end * fs));
  const f = Math.floor(fade * fs);
  const chans = Math.min(2, buffer.numberOfChannels);
  return Array.from({ length: chans }, (_, c) => {
    const out = buffer.getChannelData(c).slice(a, b);
    for (let i = 0; i < f && i < out.length; i++) {
      out[i]! *= i / f;
      out[out.length - 1 - i]! *= i / f;
    }
    return out;
  });
}

export function clipWav(buffer: AudioBuffer, start: number, end: number): Blob {
  return new Blob([encodeWav(sliceWithFades(buffer, start, end), buffer.sampleRate, 16)], { type: "audio/wav" });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
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

export type LyricVideoInput = {
  buffer: AudioBuffer;
  start: number;
  end: number;
  cover: HTMLImageElement | null;
  title: string;
  artist: string;
  /** Times relative to the clip start. */
  lines: TimedLine[];
  accent: string;
  onProgress?: (fraction: number) => void;
};

/** Draws one frame. Exported so the preview and the recording share it. */
export function drawFrame(ctx: CanvasRenderingContext2D, v: Omit<LyricVideoInput, "buffer" | "onProgress">, t: number, level: number) {
  const W = VIDEO_W;
  const H = VIDEO_H;
  ctx.save();
  ctx.fillStyle = "#0d0d10";
  ctx.fillRect(0, 0, W, H);
  if (v.cover) {
    // Blurred, darkened cover filling the frame behind everything.
    ctx.filter = "blur(48px) brightness(0.45) saturate(1.2)";
    ctx.drawImage(v.cover, -200, -200, H + 400, H + 400);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, W, H);
    const size = 820 * (1 + Math.min(level, 1) * 0.025);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 60;
    ctx.drawImage(v.cover, (W - size) / 2, 240 + (820 - size) / 2, size, size);
    ctx.shadowBlur = 0;
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 64px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(v.title, W / 2, v.cover ? 1160 : 700, W - 120);
  if (v.artist) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = '400 44px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(v.artist, W / 2, v.cover ? 1230 : 770, W - 120);
  }
  const line = lineAt(v.lines, t);
  if (line) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 76px "Helvetica Neue", Arial, sans-serif';
    const rows = wrapLines(ctx, line, W - 140);
    rows.forEach((r, i) => ctx.fillText(r, W / 2, 1450 + i * 92 - ((rows.length - 1) * 92) / 2));
  }
  const dur = v.end - v.start;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(120, H - 160, W - 240, 8);
  ctx.fillStyle = v.accent;
  ctx.fillRect(120, H - 160, (W - 240) * Math.min(1, t / dur), 8);
  ctx.restore();
}

/** Plays the clip once while recording the canvas and audio together. Takes as long as the clip. */
export async function renderLyricVideo(v: LyricVideoInput): Promise<{ blob: Blob; ext: string }> {
  const fmt = videoFormat();
  if (!fmt) throw new Error("This browser can't record video. Try Chrome, Edge or Safari on a computer.");
  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext("2d")!;
  const audio = new AudioContext();
  const src = audio.createBufferSource();
  src.buffer = v.buffer;
  const gain = audio.createGain();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  const dest = audio.createMediaStreamDestination();
  src.connect(gain).connect(analyser);
  gain.connect(dest);
  gain.connect(audio.destination); // so you hear it while it records
  const dur = v.end - v.start;
  const now = audio.currentTime + 0.1;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + 0.25);
  gain.gain.setValueAtTime(1, now + dur - 0.4);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  drawFrame(ctx, v, 0, 0);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  const data = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    const t = Math.max(0, audio.currentTime - now);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
    drawFrame(ctx, v, t, Math.sqrt(sum / data.length) * 4);
    v.onProgress?.(Math.min(1, t / dur));
    if (t < dur) raf = requestAnimationFrame(tick);
  };

  rec.start(250);
  src.start(now, v.start, dur);
  raf = requestAnimationFrame(tick);
  await new Promise<void>((r) => (src.onended = () => r()));
  cancelAnimationFrame(raf);
  drawFrame(ctx, v, dur, 0);
  await new Promise((r) => setTimeout(r, 300));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  await audio.close();
  return { blob: new Blob(chunks, { type: fmt.mime.split(";")[0] ?? fmt.mime }), ext: fmt.ext };
}
