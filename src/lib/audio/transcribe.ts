/**
 * Browser-side helper for the lyric check: resamples a decoded take to 16 kHz mono (what
 * Whisper expects) and runs recognition in a background worker. Nothing leaves the device
 * except the one-time model download from Hugging Face.
 */
import type { HeardWord } from "@/lib/lyric-align";

export type SpeechModel = {
  id: string;
  label: string;
  sizeMb: number;
  note: string;
};

export const SPEECH_MODELS: SpeechModel[] = [
  {
    id: "onnx-community/whisper-base_timestamped",
    label: "Standard",
    sizeMb: 80,
    note: "About 80 MB, downloaded once. Fine for clear vocals.",
  },
  {
    id: "onnx-community/whisper-small_timestamped",
    label: "More accurate",
    sizeMb: 250,
    note: "About 250 MB, downloaded once. Better with effects and busy mixes; best on a computer.",
  },
];

export async function toWhisperInput(buffer: AudioBuffer): Promise<Float32Array> {
  const rate = 16000;
  const length = Math.max(1, Math.ceil(buffer.duration * rate));
  const ctx = new OfflineAudioContext(1, length, rate);
  const src = ctx.createBufferSource();
  src.buffer = buffer; // channels are mixed down to mono by the 1-channel context
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

export type TranscribeEvents = {
  onStage?: (stage: string) => void;
  onDownload?: (loaded: number, total: number) => void;
};

let worker: Worker | null = null;

export function transcribe(
  audio: Float32Array,
  model: string,
  events: TranscribeEvents = {},
  language = "english",
): Promise<{ text: string; words: HeardWord[] }> {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent) => {
      const d = e.data as {
        type: string;
        stage?: string;
        loaded?: number;
        total?: number;
        text?: string;
        words?: HeardWord[];
        message?: string;
      };
      if (d.type === "stage") events.onStage?.(d.stage ?? "");
      else if (d.type === "download") events.onDownload?.(d.loaded ?? 0, d.total ?? 0);
      else if (d.type === "done") resolve({ text: d.text ?? "", words: d.words ?? [] });
      else if (d.type === "error") reject(new Error(friendlyError(d.message ?? "")));
    };
    w.onerror = (e) => reject(new Error(friendlyError(e.message)));
    w.postMessage({ type: "run", audio, model, language }, [audio.buffer]);
  });
}

function friendlyError(raw: string): string {
  if (/fetch|network|load/i.test(raw)) {
    return "Couldn't download the speech model. Check your connection and try again (it's a one-time download).";
  }
  if (/memory|allocation|OOM/i.test(raw)) {
    return "This device ran out of memory. Try the Standard model, or run the check on a computer.";
  }
  return `The lyric check failed: ${raw.slice(0, 160)}`;
}
