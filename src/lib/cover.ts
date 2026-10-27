/**
 * Cover art helpers: store rules, a text check, natural-looking image prompts, and how to fit
 * an image into the square. Pure (no canvas), so it's tested.
 */

/** Stores ask for at least 3000×3000, square, RGB, JPG or PNG. */
export const COVER_SIZE = 3000;

/** Below this many source pixels across, the exported cover will look soft when upscaled. */
export const SHARP_MIN = 1500;

const PLATFORMS = ["spotify", "apple music", "itunes", "youtube", "tiktok", "instagram", "soundcloud", "amazon music", "deezer", "tidal", "bandcamp", "suno"];

/** Things stores reject on covers: links, handles, prices, promo text, platform names. */
export function lintCoverText(texts: string[]): string[] {
  const t = texts.join(" \n ").toLowerCase();
  const out: string[] = [];
  if (/https?:\/\/|www\.|\.(com|net|org|io|co|app|fm)\b/.test(t)) out.push("Remove the web address: stores reject covers with links.");
  if (/(^|\s)@\w/.test(t)) out.push("Remove the @handle: social handles aren't allowed on covers.");
  if (/[$€£]\s?\d|free download|out now|buy now|stream now|pre-?save/.test(t)) out.push("Remove prices or promo words like \"out now\" or \"free download\".");
  const named = PLATFORMS.filter((p) => new RegExp(`\\b${p}\\b`).test(t));
  if (named.length) out.push(`Remove ${named.join(", ")}: platform names and logos aren't allowed.`);
  return out;
}

export type CoverLook = { id: string; name: string; style: string; note: string };

/** Looks that read as made by a person, not a glossy render. */
export const COVER_LOOKS: CoverLook[] = [
  {
    id: "film",
    name: "35mm film photo",
    style: "candid 35mm film photograph, natural window light, visible film grain, slightly faded colors, imperfect off-center framing, shallow depth of field",
    note: "Most covers that feel real are photos. Shoot your own if you can; this gets close.",
  },
  {
    id: "polaroid",
    name: "Instant photo",
    style: "instant film snapshot, soft flash, washed-out color shift, light leaks at the edges, everyday location",
    note: "Casual and personal. Good for acoustic, indie and lo-fi.",
  },
  {
    id: "riso",
    name: "Risograph print",
    style: "two-color risograph print, misregistered layers, halftone dots, flat shapes, uneven ink coverage, off-white paper texture",
    note: "Graphic and handmade. Works for electronic, punk and hip-hop.",
  },
  {
    id: "collage",
    name: "Paper collage",
    style: "hand-cut paper collage, torn edges, scanned magazine scraps, visible tape and shadows, muted palette",
    note: "Layered and analog. Good when the song is about memory or chaos.",
  },
  {
    id: "painted",
    name: "Gouache painting",
    style: "loose gouache painting on paper, visible brush strokes, limited palette, simple shapes, matte finish",
    note: "Warm and human. Suits folk, singer-songwriter and soft pop.",
  },
  {
    id: "type",
    name: "Type only",
    style: "",
    note: "No image at all: a plain textured color with your title. Classic, and nothing to generate.",
  },
];

export const AVOID =
  "Avoid: glossy 3D render, airbrushed skin, neon glow, lens flare, hyper-detailed fantasy art, perfect symmetry, dramatic god rays, any text or letters.";

/** A prompt for any image generator, built from what the song is about. */
export function coverPrompt(
  look: CoverLook,
  song: { title?: string | undefined; theme?: string | undefined; mood?: string | undefined; genre?: string | undefined },
): string {
  if (!look.style) return "";
  const subject = song.theme?.trim()
    ? `Subject: ${song.theme.trim().replace(/\.$/, "")}.`
    : song.title?.trim()
      ? `Subject: an everyday scene that suggests "${song.title.trim()}".`
      : "Subject: an everyday scene with one clear focal point.";
  const mood = [song.mood, song.genre].filter((x) => x && x.trim()).join(", ");
  return [
    `Square album cover, 1:1. ${look.style}.`,
    subject,
    mood ? `Mood: ${mood}.` : "",
    "Leave empty space for a title to be added later. No text in the image.",
    AVOID,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Which part of the source image fills the square: the largest centered square, shrunk by zoom
 * and moved by offsets (-1..1, where ±1 reaches the image edge).
 */
export function coverCrop(w: number, h: number, zoom = 1, ox = 0, oy = 0): { sx: number; sy: number; size: number } {
  const z = Math.max(1, zoom);
  const size = Math.min(w, h) / z;
  const cx = w / 2 + (ox * (w - size)) / 2;
  const cy = h / 2 + (oy * (h - size)) / 2;
  return { sx: Math.max(0, Math.min(w - size, cx - size / 2)), sy: Math.max(0, Math.min(h - size, cy - size / 2)), size };
}
