/**
 * The song as the Send to Suno extension receives it: the same fields the Suno Sheet sends,
 * so sending from Lyric Forge or the Band Blender gives the same result.
 */
import { exportLyrics } from "@/lib/prompt-craft";
import { composeSunoLyrics } from "@/lib/suno";
import type { ForgeState } from "@/components/forge/types";
import type { SunoPayload } from "@/components/forge/SendToSuno";

export function sunoPayloadFrom(state: ForgeState): SunoPayload {
  const r = state.blend.result;
  const raw = state.lyrics.sections.length ? composeSunoLyrics(state.lyrics.sections) : "";
  return {
    title: state.lyrics.title,
    style: r?.styleTag ?? state.lyrics.manualStyle ?? "",
    exclude: r?.excludeStyles ?? "",
    lyrics: raw ? exportLyrics(raw, state.lyrics.cleanEnding !== false).text : "",
    artists: state.blend.artists.map((a) => a.trim()).filter(Boolean),
  };
}
