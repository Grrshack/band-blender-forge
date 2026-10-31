/**
 * Bundled into extension/live.js (see scripts/build-extension.mjs). Gives the suno.com content
 * script the same pre-flight checks and fixes the Export Sheet uses, so both stay in step.
 */
import { preflight } from "../src/lib/preflight";
import { exportLyrics, hasCleanEnding, placeVocal } from "../src/lib/prompt-craft";
import { SUNO_LIMITS, findStyleLeaks, normalizeSunoVersion, scrubArtistNames } from "../src/lib/suno";

type Live = {
  limits: typeof SUNO_LIMITS;
  check: (i: { style: string; exclude: string; lyrics: string; artists: string[]; version?: string }) => Array<{
    level: "stop" | "warn";
    message: string;
    fix?: "placeVocal" | "cleanEnding" | "removeNames";
  }>;
  removeNames: (text: string, artists: string[]) => string;
  placeVocal: (style: string) => string;
  cleanEnding: (lyrics: string) => string;
};

const live: Live = {
  limits: SUNO_LIMITS,
  check({ style, exclude, lyrics, artists, version }) {
    const issues: ReturnType<Live["check"]> = style.trim()
      ? preflight({ style, exclude, version: normalizeSunoVersion(version), artistNames: artists }).map((i) =>
          findStyleLeaks(style, artists).length && /^Artist names/.test(i.message) ? { ...i, fix: "removeNames" as const } : i,
        )
      : [];
    if (lyrics.length > SUNO_LIMITS.lyrics) {
      issues.unshift({ level: "stop", message: `Lyrics are ${lyrics.length.toLocaleString()} characters; Suno's box takes ${SUNO_LIMITS.lyrics.toLocaleString()}.` });
    } else if (lyrics.trim() && !hasCleanEnding(lyrics) && exportLyrics(lyrics, true).added) {
      issues.push({ level: "warn", message: "No clean ending. An instrumental outro and [End] help Suno sing every line and stop.", fix: "cleanEnding" });
    }
    return issues;
  },
  placeVocal,
  removeNames: (text, artists) => scrubArtistNames(text, artists).text,
  cleanEnding: (lyrics) => exportLyrics(lyrics, true).text,
};

(globalThis as unknown as { __bbLive: Live }).__bbLive = live;
