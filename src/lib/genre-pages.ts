/**
 * Public genre pages (/genres and /genres/<slug>): one page per genre card and use-case card,
 * built from data the studio already has (Genre Guides cards and the 43 starter prompts), so
 * they cost nothing to run. Every prompt shown is free of artist names; the artist blends are
 * offered as ideas for the studio, which turns names into descriptions.
 */
import starters from "../../supabase/seed/community-starters.json";

import { GENRE_CARDS, USE_CASE_CARDS, type GenreCard, type UseCaseCard } from "./genre-cards";

export type StarterPrompt = { title: string; genre: string; style: string; exclude: string; note: string };

export type GenrePage = {
  slug: string;
  kind: "genre" | "use";
  name: string;
  emoji: string;
  /** <title> and H1. */
  title: string;
  /** Meta description, under ~160 characters. */
  description: string;
  lede: string;
  facts: Array<{ label: string; value: string }>;
  prompt: { style: string; exclude: string };
  starters: StarterPrompt[];
  notes: string;
  blends: Array<{ artists: string[]; description: string }>;
  /** Words for Quick song ("Make a whole song in this style"). */
  describe: string;
  related: Array<{ slug: string; name: string; emoji: string }>;
};

const STARTERS = starters as StarterPrompt[];

/** Which starter prompts belong on which page (by the starter's genre). */
const STARTER_GENRES: Record<string, string[]> = {
  "hip-hop": ["Hip-hop", "Trap", "Boom Bap", "Drill", "Lo-fi Hip-hop"],
  pop: ["Pop", "Synth-pop", "Dream Pop", "K-pop", "Hyperpop", "Art Pop"],
  rock: ["Rock", "Alternative", "Grunge", "Punk", "Post-Rock", "Shoegaze"],
  electronic: ["House", "Techno", "Drum & Bass", "Synthwave", "Dubstep", "Trip-hop", "IDM"],
  rnb: ["R&B", "Neo-Soul", "Soul", "Funk"],
  jazz: ["Jazz", "Bossa Nova", "Funk"],
  country: ["Country", "Americana", "Bluegrass"],
  metal: ["Metal", "Post-Rock"],
  indie: ["Indie Rock", "Indie Folk", "Dream Pop", "Shoegaze"],
  classical: ["Cinematic", "Ambient"],
  reggae: ["Afrobeat"],
  folk: ["Folk", "Indie Folk", "Singer-Songwriter", "Americana"],
  blues: ["Blues", "Soul", "Gospel"],
  latin: ["Bossa Nova", "Afrobeat"],
  "lofi-study": ["Lo-fi Hip-hop"],
  meditation: ["Ambient"],
  sleep: ["Ambient"],
  "background-music": ["Ambient", "Lo-fi Hip-hop"],
  "cinematic-trailer": ["Cinematic"],
  gaming: ["Synthwave", "Drum & Bass"],
  workout: ["Drum & Bass", "House"],
  "content-creator": ["Synth-pop", "House"],
};

const MAX_STARTERS = 4;

export function startersFor(slug: string): StarterPrompt[] {
  const want = STARTER_GENRES[slug] ?? [];
  return want
    .map((g) => STARTERS.find((s) => s.genre === g))
    .filter((s): s is StarterPrompt => Boolean(s))
    .slice(0, MAX_STARTERS);
}

const genreTitle = (c: GenreCard) => `${c.name} Suno prompts: style, tempo and vocals`;
const useTitle = (c: UseCaseCard) => `Suno prompt for ${c.name.toLowerCase()} music`;

function fromGenre(c: GenreCard): GenrePage {
  const family = GENRE_CARDS.filter((g) => g.id !== c.id && g.family === c.family);
  const others = GENRE_CARDS.filter((g) => g.id !== c.id && g.family !== c.family);
  const related = [...family, ...others].slice(0, 6).map((g) => ({ slug: g.id, name: g.name, emoji: g.emoji }));
  return {
    slug: c.id,
    kind: "genre",
    name: c.name,
    emoji: c.emoji,
    title: genreTitle(c),
    description: `How to get ${c.name.toLowerCase()} out of Suno: tempo, instruments, vocals, a copy-ready style prompt and exclude list, and tips. Free.`.slice(0, 160),
    lede: `${c.feel}. Here's what to put in Suno's boxes to get it, with prompts you can copy and check.`,
    facts: [
      { label: "Tempo", value: c.bpm.replace(/bpm/i, " BPM") },
      { label: "Instruments", value: c.instrumentation },
      { label: "Vocals", value: c.vocals },
    ],
    prompt: { style: c.styleTemplate, exclude: c.exclude },
    starters: startersFor(c.id),
    notes: c.notes,
    blends: c.exampleBlends,
    describe: `A ${c.name.split("/")[0]!.trim().toLowerCase()} song: ${c.feel.toLowerCase()}`,
    related,
  };
}

function fromUseCase(c: UseCaseCard): GenrePage {
  const related = USE_CASE_CARDS.filter((u) => u.id !== c.id)
    .slice(0, 6)
    .map((u) => ({ slug: u.id, name: u.name, emoji: u.emoji }));
  return {
    slug: c.id,
    kind: "use",
    name: c.name,
    emoji: c.emoji,
    title: useTitle(c),
    description: `A Suno prompt for ${c.name.toLowerCase()} music: a copy-ready style prompt, what to exclude, and the words that matter. Free.`.slice(0, 160),
    lede: c.description,
    facts: [],
    prompt: { style: c.styleTemplate, exclude: c.exclude ?? "" },
    starters: startersFor(c.id),
    notes: c.notes,
    blends: [],
    describe: `${c.name} music: ${c.description}`,
    related,
  };
}

export const GENRE_PAGES: GenrePage[] = [...GENRE_CARDS.map(fromGenre), ...USE_CASE_CARDS.map(fromUseCase)];

export const genrePageBySlug = (slug: string): GenrePage | undefined => GENRE_PAGES.find((p) => p.slug === slug);
