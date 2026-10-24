/**
 * Built-in genre cards and use-case templates for Genre Guides. Plain data, kept out of the
 * component so the screen code stays readable. Edit cards here.
 */
export type GenreCard = {
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

export const GENRE_CARDS: GenreCard[] = [
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

export type UseCaseCard = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  styleTemplate: string;
  notes: string;
};

export const USE_CASE_CARDS: UseCaseCard[] = [
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
