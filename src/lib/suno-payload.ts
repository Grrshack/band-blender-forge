/**
 * The song as the Send to Suno extension receives it: the same fields the Suno Sheet sends,
 * so sending from Lyric Forge or the Band Blender gives the same result.
 */
import { exportLyrics } from "@/lib/prompt-craft";
import { composeSunoLyrics } from "@/lib/suno";
import type { BlendSlice, ForgeState, Section } from "@/components/forge/types";
import { allTakes } from "@/lib/alt-takes";
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
    ...sunoExtras(state.blend, state.lyrics.sections),
  };
}

/** Instrumental only when the song has sections but none of them are sung; undefined = leave Suno's switch alone. */
export function instrumentalFor(sections: Section[]): boolean | undefined {
  if (!sections.length) return undefined;
  return !sections.some((s) => s.lines.some((l) => l.text.trim()));
}

const pct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : undefined);

/** What extension 1.1+ also fills: advanced options, the Instrumental switch, and every take. */
export function sunoExtras(blend: BlendSlice, sections: Section[]): Partial<SunoPayload> {
  const o = blend.sunoOptions ?? {};
  const { takes, active } = allTakes(blend.result);
  const instrumental = instrumentalFor(sections);
  const weirdness = pct(o.weirdness);
  const styleInfluence = pct(o.styleInfluence);
  return {
    ...(o.vocalGender === "male" || o.vocalGender === "female" ? { vocalGender: o.vocalGender } : {}),
    ...(weirdness !== undefined ? { weirdness } : {}),
    ...(styleInfluence !== undefined ? { styleInfluence } : {}),
    ...(instrumental !== undefined ? { instrumental } : {}),
    ...(takes.length > 1
      ? { takes: takes.map((t) => ({ label: t.label, style: t.styleTag, exclude: t.excludeStyles })), activeTake: active }
      : {}),
  };
}
