/// <reference lib="webworker" />
/**
 * Runs Whisper speech recognition in a background thread, entirely in the browser.
 * The library is loaded from a CDN only when someone runs a lyric check, so it adds nothing
 * to the app's own download; the model files are cached by the browser after the first run.
 */

// Pinned version: transformers.js 4.3.1 (released Oct 6, 2026).
const LIBRARY = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";

type RunMessage = { type: "run"; audio: Float32Array; model: string; language: string };

type Asr = (
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<{ text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

let asr: Asr | null = null;
let loaded = "";

const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);

self.onmessage = async (e: MessageEvent<RunMessage>) => {
  if (e.data.type !== "run") return;
  const { audio, model, language } = e.data;
  try {
    if (!asr || loaded !== model) {
      post({ type: "stage", stage: "Loading the speech model…" });
      const tf = (await import(/* @vite-ignore */ LIBRARY)) as {
        env: { allowLocalModels: boolean };
        pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Asr>;
      };
      tf.env.allowLocalModels = false;
      const files = new Map<string, { loaded: number; total: number }>();
      asr = await tf.pipeline("automatic-speech-recognition", model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status !== "progress" || !p.file || !p.total) return;
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let got = 0;
          let all = 0;
          files.forEach((f) => {
            got += f.loaded;
            all += f.total;
          });
          post({ type: "download", loaded: got, total: all });
        },
      });
      loaded = model;
    }
    post({ type: "stage", stage: "Listening to the take…" });
    const out = await asr(audio, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      language,
      task: "transcribe",
    });
    const words = (out.chunks ?? []).map((c) => ({
      text: c.text,
      start: c.timestamp[0],
      end: c.timestamp[1] ?? c.timestamp[0],
    }));
    post({ type: "done", text: out.text, words });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
