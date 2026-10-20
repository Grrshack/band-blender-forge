/**
 * Encodes Float32 PCM as a 320 kbps CBR MP3, the highest bitrate MP3 allows.
 *
 * - The encoder (lamejs, ~150 KB) loads only when someone exports an MP3, so it
 *   doesn't slow down the studio for everyone else.
 * - Encoding yields to the browser every few hundred milliseconds so the page
 *   stays responsive and can show progress on long songs and phones.
 */

/** Sample rates where MP3 supports 320 kbps (MPEG-1 Layer III). */
export const MP3_SAMPLE_RATES = [32000, 44100, 48000] as const;

export function canEncodeMp3(sampleRate: number): boolean {
  return (MP3_SAMPLE_RATES as readonly number[]).includes(sampleRate);
}

export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = Math.max(-1, Math.min(1, input[i]!));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

const BLOCK = 1152; // samples per MP3 frame
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

export async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!canEncodeMp3(sampleRate)) {
    throw new Error(
      `MP3 export needs a 32, 44.1 or 48 kHz sample rate, and this song is ${(sampleRate / 1000).toFixed(1)} kHz. Export as WAV instead.`,
    );
  }
  const { Mp3Encoder } = await import("@breezystack/lamejs");

  const first = channels[0] ?? new Float32Array(0);
  const left = floatToInt16(first);
  const right = channels[1] ? floatToInt16(channels[1]) : left;

  const encoder = new Mp3Encoder(2, sampleRate, 320);
  const chunks: Uint8Array[] = [];
  let lastYield = performance.now();
  for (let i = 0; i < left.length; i += BLOCK) {
    const out = encoder.encodeBuffer(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
    if (out.length) chunks.push(new Uint8Array(out));
    if (performance.now() - lastYield > 50) {
      onProgress?.(i / left.length);
      await yieldToBrowser();
      lastYield = performance.now();
    }
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  onProgress?.(1);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}
