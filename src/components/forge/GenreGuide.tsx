/**
 * GenreGuide — static reference cards for common genres, plus user-created
 * custom cards stored in Supabase. Logged-in users can create, edit and
 * delete their own cards in the "My Cards" tab.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  Clipboard,
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { Panel } from "./Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth";
import {
  listCustomGenreCards,
  saveCustomGenreCard,
  deleteCustomGenreCard,
  type CustomGenreCard,
} from "@/lib/genre.functions";

type GenreCard = {
  id: string;
  name: string;
  emoji: string;
  family: string;
  bpm: string;
  feel: string;
  instrumentation: string;
  vocals: string;
  styleTemplate: string;
  exclude: string;
  notes: string;
  exampleBlends: { artists: string[]; description: string }[];
};

type SunoParamHint = { weirdness: string; style: string; vocals: string; note: string };

const SUNO_PARAM_HINTS: Record<string, SunoParamHint> = {
  "hip-hop":   { weirdness: "25–45", style: "70–80", vocals: "Male", note: "Higher weirdness for melodic trap; lower for boom-bap." },
  "pop":        { weirdness: "15–30", style: "75–85", vocals: "Any", note: "High style keeps production polished and on-prompt." },
  "rock":       { weirdness: "35–55", style: "70–80", vocals: "Male", note: "Increase weirdness for alternative or art-rock blends." },
  "electronic": { weirdness: "45–70", style: "65–75", vocals: "None", note: "High weirdness for IDM/experimental; lower for straight house or techno." },
  "rnb":        { weirdness: "20–35", style: "70–80", vocals: "Female", note: "Low weirdness keeps the groove smooth; raise it for neo-soul." },
  "jazz":       { weirdness: "30–55", style: "60–70", vocals: "Any", note: "Lower style allows more improvisational freedom." },
  "country":    { weirdness: "10–25", style: "75–85", vocals: "Male", note: "Keep weirdness low to stay grounded in the genre." },
  "metal":      { weirdness: "40–65", style: "75–85", vocals: "Male", note: "Higher weirdness for prog/avant-metal; lower for straight thrash." },
  "indie":      { weirdness: "40–60", style: "65–75", vocals: "Any", note: "Mid weirdness suits dream pop and shoegaze textures well." },
  "classical":  { weirdness: "10–25", style: "60–70", vocals: "None", note: "Low style gives the AI compositional breathing room." },
  "reggae":     { weirdness: "15–30", style: "70–80", vocals: "Male", note: "Low weirdness preserves the rhythmic reggae feel." },
  "folk":       { weirdness: "15–30", style: "70–80", vocals: "Any", note: "Low weirdness keeps the sound authentic and organic." },
  "blues":      { weirdness: "25–40", style: "65–75", vocals: "Male", note: "Mild weirdness allows the expressive improvisation the genre needs." },
  "latin":      { weirdness: "20–35", style: "70–80", vocals: "Any", note: "Low weirdness preserves the rhythmic drive; high style locks in the groove." },
};

const GENRE_CARDS: GenreCard[] = [
  {
    id: "hip-hop",
    name: "Hip-Hop / Trap",
    emoji: "🎤",
    family: "Urban",
    bpm: "80–140bpm",
    feel: "Hard-hitting, rhythmic, attitude",
    instrumentation: "808 bass, hi-hats, trap drums, samples, synth pads",
    vocals: "Rap verses, melodic hook, ad-libs",
    styleTemplate: "hip-hop, trap, 90bpm, 808 bass, hard-hitting, melodic hook, contemporary",
    exclude: "live drums, acoustic instruments, orchestral",
    notes: "Suno responds well to explicit BPM values here. '808 bass' is a specific token that reliably triggers the low sub-bass. If you want melodic trap add 'melodic' before 'trap' — it shifts toward a Post Malone-adjacent sound.",
    exampleBlends: [
      { artists: ["Kendrick Lamar", "J. Cole"], description: "Introspective lyricism over jazzy boom-bap production" },
      { artists: ["Travis Scott", "Don Toliver"], description: "Psychedelic trap with heavy 808s and auto-tuned melodies" },
    ],
  },
  {
    id: "pop",
    name: "Pop",
    emoji: "🌟",
    family: "Mainstream",
    bpm: "100–130bpm",
    feel: "Catchy, uplifting, radio-ready",
    instrumentation: "Synth leads, electronic drums, bass, polished production",
    vocals: "Powerful lead vocal, layered harmonies, memorable hook",
    styleTemplate: "pop, upbeat, 120bpm, catchy hook, polished production, radio-ready, contemporary",
    exclude: "lo-fi, raw production, noise",
    notes: "Suno's pop output defaults to a very clean, compressed sound. Add an era or influence if you want something specific: 'Max Martin-style pop' or '2010s electropop' steers it away from generic. 'Radio-ready' as a token specifically increases the polish and compression.",
    exampleBlends: [
      { artists: ["Taylor Swift", "Olivia Rodrigo"], description: "Emotional pop-rock with confessional lyrics" },
      { artists: ["The Weeknd", "Dua Lipa"], description: "80s-influenced dark pop with heavy synth layers" },
    ],
  },
  {
    id: "rock",
    name: "Rock",
    emoji: "🎸",
    family: "Rock",
    bpm: "100–150bpm",
    feel: "Energetic, raw, guitar-driven",
    instrumentation: "Electric guitar, bass guitar, live drums, sometimes piano",
    vocals: "Powerful rock vocals, gritty texture",
    styleTemplate: "rock, electric guitar, live drums, 130bpm, powerful vocals, energetic, distortion",
    exclude: "electronic drums, synth bass, lo-fi",
    notes: "Suno defaults to over-compressed modern rock unless you specify an era. 'Classic rock' produces a 70s warm analog sound; 'alternative rock' gives you 90s-flavored grunge-adjacent output. 'Distortion' on its own is a reliable token that always adds guitar crunch.",
    exampleBlends: [
      { artists: ["Foo Fighters", "Queens of the Stone Age"], description: "Hard rock with melodic sensibility and heavy riffs" },
      { artists: ["Arctic Monkeys", "The Strokes"], description: "Indie rock with angular guitar and cool, detached vocals" },
    ],
  },
  {
    id: "electronic",
    name: "Electronic / EDM",
    emoji: "⚡",
    family: "Electronic",
    bpm: "120–150bpm",
    feel: "High-energy, danceable, synthetic",
    instrumentation: "Synthesizers, drum machines, bass drops, build-ups",
    vocals: "Processed vocals, vocal chops, or instrumental",
    styleTemplate: "electronic, EDM, 128bpm, synthesizers, bass drop, build-up, high-energy, dance floor",
    exclude: "acoustic instruments, live drums, organic sounds",
    notes: "'Bass drop' as a two-word token reliably triggers the EDM drop structure. Specify a sub-genre for more accuracy: 'progressive house' and 'future bass' produce very different outputs than generic 'EDM'. Pair with an explicit BPM — this genre is the most BPM-sensitive in Suno.",
    exampleBlends: [
      { artists: ["Flume", "Disclosure"], description: "Future bass meets UK garage — electronic with soulful elements" },
      { artists: ["Skrillex", "Diplo"], description: "High-energy EDM with aggressive bass and cinematic build-ups" },
    ],
  },
  {
    id: "rnb",
    name: "R&B / Soul",
    emoji: "💜",
    family: "Urban",
    bpm: "70–100bpm",
    feel: "Smooth, emotional, groove-based",
    instrumentation: "Electric piano, bass, subtle drums, lush chords",
    vocals: "Silky lead vocal, gospel harmonies, runs and melisma",
    styleTemplate: "R&B, soul, 85bpm, electric piano, smooth groove, lush harmonies, emotional vocals",
    exclude: "heavy distortion, aggressive bass, trap hi-hats",
    notes: "'Melisma' is a specific token that tells Suno to add the vocal runs and riffs characteristic of soul. 'Lush harmonies' produces the stacked vocal chords typical of classic R&B. Contemporary R&B benefits from 'neo-soul' — it bridges old production warmth with modern clarity.",
    exampleBlends: [
      { artists: ["Frank Ocean", "Daniel Caesar"], description: "Introspective neo-soul with jazz chords and vulnerable lyrics" },
      { artists: ["Beyoncé", "SZA"], description: "Powerful contemporary R&B with pop crossover appeal" },
    ],
  },
  {
    id: "jazz",
    name: "Jazz",
    emoji: "🎷",
    family: "Jazz & Blues",
    bpm: "60–180bpm",
    feel: "Improvisational, sophisticated, warm",
    instrumentation: "Double bass, jazz drums, piano, horn section",
    vocals: "Scat, standards delivery, breathy phrasing",
    styleTemplate: "jazz, swing, upright bass, piano, saxophone, 110bpm, sophisticated, warm, improvisational",
    exclude: "electronic drums, synthesizers, pop production",
    notes: "Suno's jazz output varies dramatically with tempo — 'swing' at 110bpm produces bebop-adjacent sounds; 'bossa nova' at 130bpm gives you something very different. 'Upright bass' (not just 'bass') is the key token for authentic jazz texture. Add the specific instrument you want featured: it usually leads the arrangement.",
    exampleBlends: [
      { artists: ["Miles Davis", "John Coltrane"], description: "Modal jazz exploration with blue note melodies" },
      { artists: ["Norah Jones", "Diana Krall"], description: "Contemporary jazz-pop with warm piano and intimate vocals" },
    ],
  },
  {
    id: "country",
    name: "Country",
    emoji: "🤠",
    family: "Americana",
    bpm: "80–130bpm",
    feel: "Storytelling, twangy, heartfelt",
    instrumentation: "Acoustic guitar, fiddle, pedal steel, banjo",
    vocals: "Southern twang, storytelling delivery",
    styleTemplate: "country, acoustic guitar, pedal steel, fiddle, 100bpm, storytelling, twang, heartfelt",
    exclude: "electronic production, 808 bass, trap beats",
    notes: "'Pedal steel' is the single most reliable token for authentic country sound — Suno knows exactly what to do with it. Without it you often get something closer to folk or soft rock. 'Southern twang' nudges the vocal delivery. 'Storytelling' biases toward narrative structure in how the lyrics and production develop.",
    exampleBlends: [
      { artists: ["Johnny Cash", "Kris Kristofferson"], description: "Outlaw country with dark storytelling and sparse production" },
      { artists: ["Kacey Musgraves", "Chris Stapleton"], description: "Modern country with pop sensibility and raw emotional power" },
    ],
  },
  {
    id: "metal",
    name: "Metal",
    emoji: "🤘",
    family: "Rock",
    bpm: "120–200bpm",
    feel: "Heavy, aggressive, intense",
    instrumentation: "Distorted guitar, double kick drums, heavy bass",
    vocals: "Screaming, clean metal vocals, or both",
    styleTemplate: "metal, heavy distortion, double kick drums, 160bpm, aggressive, powerful riffs, intense",
    exclude: "acoustic instruments, soft production, pop hooks",
    notes: "'Double kick drums' is the key token that separates metal from hard rock in Suno. 'Heavy distortion' + a high BPM anchors the tempo. Specify the sub-genre for best results: 'death metal' produces growled vocals and blast beats; 'power metal' adds melodic clean vocals and epic orchestral elements; 'doom metal' slows to 60–70bpm with drone-heavy textures.",
    exampleBlends: [
      { artists: ["Metallica", "Pantera"], description: "Thrash-groove hybrid with tight riffing and aggressive vocals" },
      { artists: ["Ghost", "Mastodon"], description: "Progressive metal with theatrical elements and dynamic shifts" },
    ],
  },
  {
    id: "indie",
    name: "Indie / Alternative",
    emoji: "🌿",
    family: "Indie",
    bpm: "90–130bpm",
    feel: "Atmospheric, introspective, textured",
    instrumentation: "Guitars, bass, drums, occasional synths and strings",
    vocals: "Indie vocal style — understated, emotional, often reverb-heavy",
    styleTemplate: "indie rock, alternative, guitar-driven, 110bpm, atmospheric, introspective, reverb vocals",
    exclude: "heavy EDM production, over-compressed sound",
    notes: "'Reverb vocals' is a consistent token for the indie aesthetic — it produces the dreamy, spacious vocal quality. Pairing 'atmospheric' with 'introspective' tends to produce more interesting chord progressions than straightforward indie rock alone. If you want shoegaze, replace 'indie rock' with 'shoegaze, wall of sound, dream pop' — it's a very different production space.",
    exampleBlends: [
      { artists: ["Radiohead", "Bon Iver"], description: "Art-rock introspection with lush textures and complex arrangements" },
      { artists: ["Vampire Weekend", "Tame Impala"], description: "Psychedelic indie pop with eclectic production and layered sounds" },
    ],
  },
  {
    id: "classical",
    name: "Classical / Orchestral",
    emoji: "🎻",
    family: "Classical",
    bpm: "60–120bpm",
    feel: "Majestic, emotive, structured",
    instrumentation: "Full orchestra: strings, brass, woodwinds, percussion, piano",
    vocals: "Operatic soprano, choir, or instrumental only",
    styleTemplate: "orchestral, classical, strings, brass, choir, 80bpm, majestic, emotive, cinematic",
    exclude: "electronic sounds, drum machines, pop production",
    notes: "Suno responds best to period-specific classical framing: 'Baroque' produces harpsichord and counterpoint; 'Romantic era' produces lush 19th-century orchestration; 'contemporary classical' gives you modern minimalist or neoclassical textures (closer to Max Richter or Ólafur Arnalds). Without a period, output trends toward generic film score.",
    exampleBlends: [
      { artists: ["Hans Zimmer", "John Williams"], description: "Epic cinematic scoring with sweeping orchestral arrangements" },
      { artists: ["Ludovico Einaudi", "Max Richter"], description: "Neoclassical minimalism with piano and chamber strings" },
    ],
  },
  {
    id: "reggae",
    name: "Reggae / Dancehall",
    emoji: "🌴",
    family: "World",
    bpm: "70–100bpm",
    feel: "Laid-back, rhythmic, positive",
    instrumentation: "Skank guitar, bass, reggae drums, organ",
    vocals: "Relaxed delivery, Jamaican patois, toasting",
    styleTemplate: "reggae, skank guitar, bass-forward, 80bpm, laid-back, positive vibes, Jamaican rhythm",
    exclude: "heavy distortion, aggressive production, trap beats",
    notes: "'Skank guitar' is the specific token for the off-beat rhythmic guitar strum that defines reggae. Without it, Suno often produces something closer to pop with island vibes. 'Dub' as a modifier adds heavy reverb and delay effects with a stripped-back production. 'Dancehall' shifts to a more upbeat digital riddim style.",
    exampleBlends: [
      { artists: ["Bob Marley", "Peter Tosh"], description: "Classic roots reggae with spiritual themes and organic production" },
      { artists: ["Vybz Kartel", "Sean Paul"], description: "Modern dancehall with digital production and high energy" },
    ],
  },
  {
    id: "folk",
    name: "Folk / Americana",
    emoji: "🪕",
    family: "Americana",
    bpm: "70–120bpm",
    feel: "Intimate, authentic, storytelling",
    instrumentation: "Acoustic guitar, banjo, mandolin, harmonica, upright bass",
    vocals: "Raw, intimate, close-mic'd feel",
    styleTemplate: "folk, acoustic guitar, intimate, 90bpm, storytelling, authentic, raw vocals, warm",
    exclude: "electronic production, polished mixing, synthetic instruments",
    notes: "'Close-mic'd' is a useful token that pushes Suno toward an intimate, dry vocal sound rather than a reverb-heavy pop feel. 'Authentic' and 'raw' together consistently steer away from over-produced output. If you want Americana specifically, add 'Americana, dusty, road-worn' — it adds a weathered quality that pure 'folk' misses.",
    exampleBlends: [
      { artists: ["Bob Dylan", "Tom Waits"], description: "Blues-folk with gravelly vocals and literary lyricism" },
      { artists: ["Phoebe Bridgers", "Iron & Wine"], description: "Modern folk with lush arrangements and introspective themes" },
    ],
  },
  {
    id: "blues",
    name: "Blues",
    emoji: "🎸",
    family: "Jazz & Blues",
    bpm: "60–110bpm",
    feel: "Raw emotion, call-and-response, soulful",
    instrumentation: "Electric or acoustic guitar, harmonica, bass, shuffle drums",
    vocals: "Gravelly, expressive, blues phrasing",
    styleTemplate: "blues, electric guitar, shuffle rhythm, 80bpm, soulful, raw, expressive, 12-bar blues",
    exclude: "polished production, electronic elements, rap",
    notes: "'12-bar blues' as a tag explicitly sets the chord structure and Suno responds well to it. 'Shuffle rhythm' is the specific term for the swinging triplet feel of blues — without it you often get straight-time rhythm that loses the groove. Specify 'Chicago blues' for urban electric, 'Delta blues' for raw acoustic, or 'Texas blues' for a more aggressive electric style.",
    exampleBlends: [
      { artists: ["B.B. King", "Muddy Waters"], description: "Classic electric blues with expressive guitar and vocal interplay" },
      { artists: ["Gary Clark Jr.", "Joe Bonamassa"], description: "Contemporary blues with rock influence and virtuosic guitar" },
    ],
  },
  {
    id: "latin",
    name: "Latin",
    emoji: "💃",
    family: "World",
    bpm: "90–130bpm",
    feel: "Rhythmic, passionate, danceable",
    instrumentation: "Percussion, brass, guitar, piano, bass",
    vocals: "Passionate delivery, Spanish or Latin phrasing",
    styleTemplate: "latin, salsa, percussion-driven, 110bpm, brass horns, passionate, danceable, rhythmic",
    exclude: "electronic beats, lo-fi, slow tempos",
    notes: "Specify the sub-genre — Suno's Latin output varies wildly: 'salsa' produces brass-heavy big band arrangements; 'bossa nova' produces delicate jazz-guitar textures; 'reggaeton' produces electronic dancehall with dembow rhythm; 'cumbia' produces accordion and folk percussion. Without a sub-genre, output defaults toward generic latin pop.",
    exampleBlends: [
      { artists: ["Marc Anthony", "Celia Cruz"], description: "Classic salsa with powerful brass and passionate vocals" },
      { artists: ["Bad Bunny", "J Balvin"], description: "Urban latin trap and reggaeton with modern production" },
    ],
  },
];

// ── Use-case templates (unchanged) ────────────────────────────────────────────

type UseCaseCard = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  styleTemplate: string;
  notes: string;
};

const USE_CASE_CARDS: UseCaseCard[] = [
  {
    id: "podcast-intro",
    name: "Podcast Intro",
    emoji: "🎙️",
    description: "Short, punchy music that establishes mood and ends cleanly — 15–30 seconds, ideally with a strong ending hit.",
    styleTemplate: "podcast intro, short, punchy, 120bpm, electronic, builds quickly, clean ending, professional",
    notes: "'Clean ending' and 'short' are surprisingly effective Suno tokens — they influence the structural decisions. 'Builds quickly' pushes toward a rapid intro rather than a slow build. If you need a specific duration, describe it in terms of structure: 'intro, verse, quick end' rather than trying to specify seconds.",
  },
  {
    id: "background-music",
    name: "Background Music",
    emoji: "🎵",
    description: "Non-distracting music for working, studying, or content — no drops, no builds, steady energy throughout.",
    styleTemplate: "background music, ambient, 95bpm, non-distracting, steady energy, no drops, focus, instrumental",
    notes: "'No drops' is a key token that prevents Suno from adding the dynamic build-and-release typical of produced music. 'Non-distracting' and 'focus' together consistently push output toward simpler, more repetitive textures. 'Instrumental' is essential — any vocal hook will pull attention away from whatever the music is backing.",
  },
  {
    id: "content-creator",
    name: "Content Creator / YouTube",
    emoji: "📹",
    description: "Energetic, branded music for YouTube intros, reels, or short-form video — punchy and memorable.",
    styleTemplate: "upbeat, content creator, YouTube, 130bpm, energetic, punchy, electronic, bright, memorable intro",
    notes: "The 'YouTube' token has a specific effect in Suno — it produces the bright, compressed, hi-fi sound you hear in professional content creator music. Pair with a platform if relevant: 'TikTok' produces shorter, more hook-focused output; 'Instagram reel' tends toward trending audio aesthetics.",
  },
  {
    id: "lofi-study",
    name: "Lo-Fi Study / Chill",
    emoji: "📚",
    description: "The classic lo-fi aesthetic — vinyl crackle, mellow beats, no progression — designed for background concentration.",
    styleTemplate: "lo-fi hip-hop, chill, 75bpm, vinyl crackle, Rhodes piano, soft drums, relaxed, study, warm, repetitive",
    notes: "'Vinyl crackle' is the non-negotiable lo-fi signal. 'Repetitive' tells Suno to loop rather than build — you want texture, not a journey.",
  },
  {
    id: "workout",
    name: "Workout / High Energy",
    emoji: "💪",
    description: "Driving BPM with relentless energy — keeps people moving without the mental overhead of lyrics.",
    styleTemplate: "workout, high energy, 140bpm, electronic, driving, powerful, aggressive, pounding bass, motivational",
    notes: "'Driving' + 'pounding bass' is the combination that tells Suno you need physical momentum rather than emotional expression. Front-load BPM — it's the most important variable here.",
  },
  {
    id: "meditation",
    name: "Meditation / Ambient",
    emoji: "🧘",
    description: "Slow, textural music for meditation, breathwork, or sleep — no pulse, evolving slowly.",
    styleTemplate: "meditation, ambient, beatless, 60bpm, soft pads, nature sounds, calm, healing, slow evolving, no drums",
    notes: "'Beatless' is essential — any rhythmic element will interrupt a meditative state. 'Evolving' tells Suno to move through textures rather than repeat.",
  },
  {
    id: "cinematic-trailer",
    name: "Cinematic Trailer",
    emoji: "🎬",
    description: "Epic tension-and-release structure with a big drop — designed for video intros, montages, and teasers.",
    styleTemplate: "cinematic trailer, epic, orchestral, 90bpm, rising tension, big drop, brass, strings, powerful, dramatic, film score",
    notes: "'Rising tension' + 'big drop' as a pair signals Suno to build and release rather than stay flat. Add 'trailer music' explicitly — it's a recognised sub-genre in Suno.",
  },
  {
    id: "gaming",
    name: "Gaming Background",
    emoji: "🎮",
    description: "Loopable background music that fits a game environment — tense, exploratory, or action-driven.",
    styleTemplate: "video game music, chiptune, electronic, 120bpm, loopable, adventurous, 8-bit inspired, dynamic, exploration",
    notes: "Specify the game mood: 'exploration' gives ambient loopable textures; 'battle' gives tense driving energy; 'boss fight' gives heavy and relentless. They produce very different results.",
  },
  {
    id: "corporate",
    name: "Corporate / Commercial",
    emoji: "💼",
    description: "Clean, positive background for business presentations, ads, or explainer videos.",
    styleTemplate: "corporate, uplifting, acoustic guitar, light percussion, positive, professional, 100bpm, clean production, optimistic",
    notes: "The dreaded but useful category. 'Acoustic guitar' + 'optimistic' reliably produces the clean, inoffensive corporate sound. Add 'no lyrics' if you want purely instrumental.",
  },
  {
    id: "wedding",
    name: "Wedding / Ceremony",
    emoji: "💍",
    description: "Romantic, elegant music for ceremony or reception — timeless and emotionally safe.",
    styleTemplate: "wedding, romantic, orchestral strings, piano, 80bpm, elegant, emotional, warm, timeless, ceremonial",
    notes: "'Ceremonial' as a tag reliably keeps Suno out of generic pop territory. Add the specific moment: 'processional' produces a slower walking pace, 'first dance' produces something more intimate.",
  },
  {
    id: "sleep",
    name: "Sleep / ASMR",
    emoji: "😴",
    description: "Ultra-quiet, almost imperceptible textures — designed to fade into the background of sleep.",
    styleTemplate: "sleep music, ambient, very quiet, soft, 50bpm, barely audible, gentle pads, no melody, no rhythm, soothing",
    notes: "'Very quiet' and 'barely audible' actually influence Suno's dynamic mix level. 'No melody' prevents hooks that would pull attention back — you want pure texture.",
  },
];

// ── Empty form state ───────────────────────────────────────────────────────────

type CardFormState = {
  id?: string;
  name: string;
  emoji: string;
  family: string;
  bpm: string;
  feel: string;
  instrumentation: string;
  vocals: string;
  style_template: string;
  exclude: string;
  notes: string;
};

const EMPTY_FORM: CardFormState = {
  name: "",
  emoji: "🎵",
  family: "Custom",
  bpm: "",
  feel: "",
  instrumentation: "",
  vocals: "",
  style_template: "",
  exclude: "",
  notes: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GenreGuide({ onApplyToBlend }: { onApplyToBlend?: (genre: string) => void }) {
  const { session } = useAuth();
  const [view, setView] = useState<"genres" | "usecases" | "mine">("genres");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── My Cards state ────────────────────────────────────────────────────────
  const [myCards, setMyCards] = useState<CustomGenreCard[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [myCopied, setMyCopied] = useState<string | null>(null);

  // Load user's custom cards when they open the My Cards tab or log in
  const loadMyCards = useCallback(async () => {
    if (!session) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const cards = await listCustomGenreCards();
      setMyCards(cards);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not load your cards.");
    } finally {
      setMyLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (view === "mine" && session) void loadMyCards();
  }, [view, session, loadMyCards]);

  // On mount, read ?card= param and auto-expand that card.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cardId = params.get("card");
      if (cardId) {
        setExpanded(cardId);
        setTimeout(() => {
          cardRefs.current.get(cardId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    } catch {
      // URL parsing unavailable
    }
  }, []);

  const families = ["All", ...Array.from(new Set(GENRE_CARDS.map((c) => c.family)))];

  const filtered = GENRE_CARDS.filter((c) => {
    const matchFamily = family === "All" || c.family === family;
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.family.toLowerCase().includes(query.toLowerCase());
    return matchFamily && matchQuery;
  });

  const copyTag = async (id: string, tag: string) => {
    await navigator.clipboard.writeText(tag);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyMyTag = async (id: string, tag: string) => {
    await navigator.clipboard.writeText(tag);
    setMyCopied(id);
    setTimeout(() => setMyCopied(null), 1500);
  };

  const copyLink = async (cardId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=genres&card=${cardId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(cardId);
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const exportCardImage = async (cardId: string) => {
    const el = cardRefs.current.get(cardId);
    if (!el) return;
    setExporting(cardId);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(el, {
        backgroundColor: "#0d0d12",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.download = `${cardId}-genre-card.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      const card = GENRE_CARDS.find((c) => c.id === cardId);
      if (card) await navigator.clipboard.writeText(card.styleTemplate);
    } finally {
      setExporting(null);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (card: CustomGenreCard) => {
    setForm({
      id: card.id,
      name: card.name,
      emoji: card.emoji,
      family: card.family,
      bpm: card.bpm,
      feel: card.feel,
      instrumentation: card.instrumentation,
      vocals: card.vocals,
      style_template: card.style_template,
      exclude: card.exclude,
      notes: card.notes,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.style_template.trim()) return;
    setSaving(true);
    setMyError(null);
    try {
      const saved = await saveCustomGenreCard({ data: form });
      setMyCards((prev) => {
        if (form.id) {
          return prev.map((c) => (c.id === form.id ? saved : c));
        }
        return [saved, ...prev];
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not save card.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setMyError(null);
    try {
      await deleteCustomGenreCard({ data: { id } });
      setMyCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Could not delete card.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex rounded-lg border border-border p-0.5">
        {(["genres", "usecases", "mine"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-md py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
              view === v
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "genres" ? "Genre Cards" : v === "usecases" ? "Use Case Templates" : "My Cards"}
          </button>
        ))}
      </div>

      {/* ── Use Case Templates ── */}
      {view === "usecases" && (
        <Panel
          title="Use Case Templates"
          subtitle="Style prompts organised by what the music is for, not just how it sounds."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {USE_CASE_CARDS.map((card) => (
              <div key={card.id} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-lg">{card.emoji}</span>
                    <span className="font-semibold text-sm text-foreground">{card.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{card.description}</p>
                </div>
                <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                  <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                    Style template
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-foreground/80">{card.styleTemplate}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-border px-2 text-[10px]"
                      onClick={() => void copyTag(card.id, card.styleTemplate)}
                    >
                      <Clipboard className="size-2.5" />
                      {copied === card.id ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{card.notes}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Preset Genre Cards ── */}
      {view === "genres" && (
        <Panel
          title="Genre Reference Cards"
          subtitle="Ready-to-use Suno style templates and production notes for common genres."
        >
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search genres…"
              className="h-8 w-48 border-border bg-card/60 text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {families.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
                    family === f
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((card) => (
              <div
                key={card.id}
                ref={(el) => { if (el) cardRefs.current.set(card.id, el); else cardRefs.current.delete(card.id); }}
                className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden"
              >
                {/* Card header */}
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(expanded === card.id ? null : card.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{card.emoji}</span>
                      <span className="font-semibold text-sm text-foreground">{card.name}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {card.bpm}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{card.feel}</p>
                  </div>
                  {expanded === card.id ? (
                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Style tag — always visible */}
                <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                  <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                    Style template
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-foreground/80">{card.styleTemplate}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 border-border px-2 text-[10px]"
                      onClick={() => void copyTag(card.id, card.styleTemplate)}
                    >
                      <Clipboard className="size-2.5" />
                      {copied === card.id ? "Copied!" : "Copy"}
                    </Button>
                    {onApplyToBlend && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-primary/40 bg-primary/5 px-2 text-[10px] text-primary hover:bg-primary/15"
                        onClick={() => onApplyToBlend(card.name)}
                      >
                        Set as genre target →
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === card.id && (
                  <div className="border-t border-border/50 space-y-3 p-4 text-xs">
                    <Detail label="Instrumentation" value={card.instrumentation} />
                    <Detail label="Vocals" value={card.vocals} />
                    <Detail label="Exclude from Suno" value={card.exclude} mono />
                    <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                      <div className="mb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                        Suno note
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground/70">{card.notes}</p>
                    </div>
                    {/* Suno Parameter Guide */}
                    {SUNO_PARAM_HINTS[card.id] && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                        <div className="mb-2 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                          Suno parameter guide
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-1.5">
                          <div>
                            <div className="font-mono text-[9px] text-muted-foreground mb-0.5">Weirdness</div>
                            <div className="text-[11px] font-semibold text-foreground">{SUNO_PARAM_HINTS[card.id]!.weirdness}</div>
                          </div>
                          <div>
                            <div className="font-mono text-[9px] text-muted-foreground mb-0.5">Style</div>
                            <div className="text-[11px] font-semibold text-foreground">{SUNO_PARAM_HINTS[card.id]!.style}</div>
                          </div>
                          <div>
                            <div className="font-mono text-[9px] text-muted-foreground mb-0.5">Vocals</div>
                            <div className="text-[11px] font-semibold text-foreground">{SUNO_PARAM_HINTS[card.id]!.vocals}</div>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{SUNO_PARAM_HINTS[card.id]!.note}</p>
                      </div>
                    )}

                    <div>
                      <div className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                        Example artist blends
                      </div>
                      {card.exampleBlends.map((b, i) => (
                        <div key={i} className="mb-2 last:mb-0">
                          <span className="font-medium text-foreground/90">{b.artists.join(" × ")}</span>
                          <p className="text-[11px] text-muted-foreground">{b.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Share row */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
                      <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase mr-1">
                        Share
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-border px-2 text-[10px]"
                        onClick={() => void copyLink(card.id)}
                      >
                        <Link2 className="size-2.5" />
                        {linkCopied === card.id ? "Link copied!" : "Copy link"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 border-border px-2 text-[10px]"
                        disabled={exporting === card.id}
                        onClick={() => void exportCardImage(card.id)}
                      >
                        <Camera className="size-2.5" />
                        {exporting === card.id ? "Exporting…" : "Save as image"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── My Cards ── */}
      {view === "mine" && (
        <Panel
          title="My Cards"
          subtitle="Your personal genre templates — save anything you use repeatedly."
        >
          {/* Not logged in */}
          {!session && (
            <div className="py-10 text-center">
              <p className="font-mono text-sm text-muted-foreground">
                Sign in to create and save your own genre cards.
              </p>
            </div>
          )}

          {session && (
            <div className="space-y-4">
              {/* Error */}
              {myError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-[11px] text-destructive">
                  {myError}
                </p>
              )}

              {/* Create / Edit Form */}
              {showForm && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] tracking-wider text-primary uppercase">
                      {form.id ? "Edit card" : "New card"}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <Input
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                        placeholder="🎵"
                        className="w-16 shrink-0 border-border bg-card/60 text-center text-lg"
                        maxLength={4}
                      />
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Card name *"
                        className="border-border bg-card/60 text-xs"
                      />
                    </div>
                    <Input
                      value={form.family}
                      onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                      placeholder="Family (e.g. Electronic)"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={form.bpm}
                      onChange={(e) => setForm((f) => ({ ...f, bpm: e.target.value }))}
                      placeholder="BPM (e.g. 120bpm)"
                      className="border-border bg-card/60 text-xs"
                    />
                    <Input
                      value={form.feel}
                      onChange={(e) => setForm((f) => ({ ...f, feel: e.target.value }))}
                      placeholder="Feel / vibe"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                      Style template *
                    </label>
                    <textarea
                      value={form.style_template}
                      onChange={(e) => setForm((f) => ({ ...f, style_template: e.target.value }))}
                      placeholder="Comma-separated Suno style tags…"
                      rows={2}
                      className="w-full rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={form.instrumentation}
                      onChange={(e) => setForm((f) => ({ ...f, instrumentation: e.target.value }))}
                      placeholder="Instrumentation"
                      className="border-border bg-card/60 text-xs"
                    />
                    <Input
                      value={form.vocals}
                      onChange={(e) => setForm((f) => ({ ...f, vocals: e.target.value }))}
                      placeholder="Vocals"
                      className="border-border bg-card/60 text-xs"
                    />
                  </div>

                  <Input
                    value={form.exclude}
                    onChange={(e) => setForm((f) => ({ ...f, exclude: e.target.value }))}
                    placeholder="Exclude from Suno (optional)"
                    className="border-border bg-card/60 text-xs"
                  />

                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Production notes (optional)"
                    rows={2}
                    className="w-full rounded-md border border-border bg-card/60 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                      className="font-mono text-[11px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={saving || !form.name.trim() || !form.style_template.trim()}
                      className="gap-1.5 font-mono text-[11px]"
                    >
                      <Save className="size-3.5" />
                      {saving ? "Saving…" : "Save card"}
                    </Button>
                  </div>
                </div>
              )}

              {/* New card button */}
              {!showForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCreateForm}
                  className="gap-1.5 border-primary/40 font-mono text-[11px] text-primary hover:bg-primary/10"
                >
                  <Plus className="size-3.5" />
                  New card
                </Button>
              )}

              {/* Loading */}
              {myLoading && (
                <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">
                  Loading…
                </p>
              )}

              {/* Empty state */}
              {!myLoading && myCards.length === 0 && !showForm && (
                <div className="rounded-xl border border-border border-dashed py-10 text-center">
                  <p className="font-mono text-sm text-muted-foreground">No cards yet.</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
                    Create one to save a style template you use often.
                  </p>
                </div>
              )}

              {/* My cards list */}
              {!myLoading && myCards.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {myCards.map((card) => (
                    <div
                      key={card.id}
                      className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{card.emoji}</span>
                            <span className="font-semibold text-sm text-foreground">{card.name}</span>
                            {card.bpm && (
                              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                                {card.bpm}
                              </span>
                            )}
                          </div>
                          {card.feel && (
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{card.feel}</p>
                          )}
                        </div>
                        {/* Edit / Delete */}
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(card)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(card.id)}
                            disabled={deleting === card.id}
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Style template */}
                      <div className="border-t border-border/50 bg-primary/5 px-4 py-2.5">
                        <div className="mb-1 font-mono text-[9px] tracking-widest text-primary/70 uppercase">
                          Style template
                        </div>
                        <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
                          {card.style_template}
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 border-border px-2 text-[10px]"
                            onClick={() => void copyMyTag(card.id, card.style_template)}
                          >
                            <Clipboard className="size-2.5" />
                            {myCopied === card.id ? "Copied!" : "Copy"}
                          </Button>
                          {onApplyToBlend && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 border-primary/40 bg-primary/5 px-2 text-[10px] text-primary hover:bg-primary/15"
                              onClick={() => onApplyToBlend(card.name)}
                            >
                              Set as genre target →
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Optional expanded detail */}
                      {(card.instrumentation || card.vocals || card.exclude || card.notes) && (
                        <div className="border-t border-border/50 space-y-2 p-4 text-xs">
                          {card.instrumentation && <Detail label="Instrumentation" value={card.instrumentation} />}
                          {card.vocals && <Detail label="Vocals" value={card.vocals} />}
                          {card.exclude && <Detail label="Exclude from Suno" value={card.exclude} mono />}
                          {card.notes && (
                            <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                              <div className="mb-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                                Notes
                              </div>
                              <p className="text-[11px] leading-relaxed text-foreground/70">{card.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
        {label}
      </div>
      <p className={cn("text-[11px] leading-relaxed text-foreground/80", mono && "font-mono")}>{value}</p>
    </div>
  );
}
