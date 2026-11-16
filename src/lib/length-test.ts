/**
 * Short vs Full style test (Nov 2026).
 *
 * Every blend now comes back in two lengths from the same AI call: the Full style (the Tag list or
 * Studio Brief, up to ~700 characters) and a Short one (4–7 descriptors, about 250 characters).
 *
 *   "both"  The test is running: a "Short" take tab sits next to Main (the Full style). Whichever
 *           tab is open is what Copy, the Suno Sheet, Send to Suno and the extension use, and
 *           each rated take records which length it was, so the two can be compared.
 *   "full"  Test off, Full only (how it was before).
 *   "short" Test off, the Short style becomes the main style.
 *
 * To stop the test, change STYLE_LENGTH_TEST below and publish. Nothing else needs to change.
 */
import type { BlendResult } from "@/components/forge/types";
import { activeTakeId, takesOf, withAlternates, type AltTake } from "./alt-takes";
import { looksLikeBrief } from "./prompt-craft";
import { SHORT_STYLE_MAX, fitToLimit } from "./suno";

export type LengthMode = "both" | "full" | "short";

export const STYLE_LENGTH_TEST: LengthMode = "both";

export const SHORT_TAKE_ID = "short";
export const SHORT_TAKE_LABEL = "Short";

/** The Short style: the AI's own, or failing that the first tags of the Tag list that fit. */
export function shortStyleOf(r: BlendResult): string {
  const ai = (r.styleShort ?? "").trim();
  if (ai) return fitToLimit(ai, SHORT_STYLE_MAX);
  const tagText = [r.styleTag, r.styleAlt].find((t) => t && !looksLikeBrief(t)) ?? "";
  let out = "";
  for (const t of tagText.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 7)) {
    const next = out ? `${out}, ${t}` : t;
    if (next.length > SHORT_STYLE_MAX) break;
    out = next;
  }
  return out;
}

/** Applies the test to a fresh blend result. */
export function applyLengthTest(r: BlendResult, mode: LengthMode = STYLE_LENGTH_TEST): BlendResult {
  const short = shortStyleOf(r);
  if (mode === "full" || !short) return r;
  if (mode === "short") {
    return { ...r, styleTag: short, styleFormat: "tags", styleAlt: undefined, briefParts: undefined, styleShort: short };
  }
  const take: AltTake = {
    id: SHORT_TAKE_ID,
    label: SHORT_TAKE_LABEL,
    angle: "Length test: the same sound in 4–7 descriptors. Try both tabs in Suno and rate each take.",
    styleTag: short,
    styleFormat: "tags",
    excludeStyles: r.excludeStyles ?? "",
  };
  return withAlternates(r, [take]);
}

/** Which length is open, for take ratings: "short", "full" (Main while the test runs), or "". */
export function lengthOfActive(r: BlendResult | null | undefined, mode: LengthMode = STYLE_LENGTH_TEST): "short" | "full" | "" {
  if (!r || mode !== "both") return "";
  const id = activeTakeId(r);
  if (id === SHORT_TAKE_ID) return "short";
  if (id === "main" && takesOf(r).some((t) => t.id === SHORT_TAKE_ID)) return "full";
  return "";
}

/** The usage-log detail for a rated take: "4|short", "2|full", or just the rating. */
export const ratingDetail = (rating: number, length: "short" | "full" | ""): string => (length ? `${rating}|${length}` : String(rating));
