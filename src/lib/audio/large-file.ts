/**
 * Phones have far less memory for the browser than computers. Decoding a long WAV can use
 * 200 MB or more and make a phone's browser reload the page, losing the work. Pure check
 * plus a confirm prompt, used before any audio file is decoded.
 */

/** Above this size on a phone, warn before decoding. An MP3 of a whole song is ~5–15 MB. */
export const PHONE_AUDIO_WARN_BYTES = 40 * 1024 * 1024;

export function isLikelyPhone(width: number, coarsePointer: boolean): boolean {
  return width < 900 && coarsePointer;
}

export function largeAudioWarning(bytes: number, phone: boolean): string | null {
  if (!phone || bytes < PHONE_AUDIO_WARN_BYTES) return null;
  const mb = Math.round(bytes / (1024 * 1024));
  return `This file is ${mb} MB. Phones can run out of memory on files this big, and the page may reload and lose your work. An MP3 of the same song works much better. Continue anyway?`;
}

/** True if it's fine to go ahead (small file, a computer, or the person said yes). */
export function confirmLargeAudio(file: File): boolean {
  if (typeof window === "undefined") return true;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const msg = largeAudioWarning(file.size, isLikelyPhone(window.innerWidth, coarse));
  return msg ? window.confirm(msg) : true;
}
