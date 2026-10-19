import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Encodes stereo Float32 PCM as an MP3 file at 320 kbps CBR — the highest
 * quality MP3 supports. Stereo joint mode is the encoder default.
 */
export function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  if (channels.length < 2) {
    channels = [channels[0] ?? new Float32Array(0), channels[0] ?? new Float32Array(0)];
  }
  const left = floatToInt16(channels[0]!);
  const right = floatToInt16(channels[1]!);

  const encoder = new Mp3Encoder(2, sampleRate, 320);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right.subarray(i, i + blockSize);
    const out = encoder.encodeBuffer(l, r);
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const flush = encoder.flush();
  if (flush.length) chunks.push(new Uint8Array(flush));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = Math.max(-1, Math.min(1, input[i]!));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}
