/**
 * Canned AI answers for the automatic click-through tests, so they cost nothing and give the
 * same result every run. Only used when the server runs with BB_FAKE_AI=1 (the test script
 * sets it); the live site never sets it, so real visitors always get the real AI.
 */

type Json = Record<string, unknown>;

const PARTS = {
  sound: "Dark synthpop with a cinematic, melancholic mood.",
  pulse: "92 BPM, steady and driving, never rushed.",
  players: "Pulsing analog bass, gated drum machine, glassy arpeggiated synths.",
  voice: "Breathy female alto, close and upfront, sitting above the synths.",
  arc: "Sparse verses hold back the drums; the chorus opens wide with layered synths.",
  finish: "Polished and wide with a touch of tape warmth.",
};

const TAGS =
  "dark synthpop, cinematic, melancholic, 92 bpm, analog bass, gated drum machine, glassy synth arpeggios, breathy female alto close and upfront, wide polished mix";

const SECTIONS = [
  { tag: "[Intro]", cue: "Synths swell", lines: [] },
  {
    tag: "[Verse 1]",
    cue: "Whispered, sparse",
    lines: [
      "Streetlights hum a song I used to know",
      "Puddles hold the city upside down",
      "Every window glowing soft and low",
      "I keep your number, never make a sound",
    ],
  },
  {
    tag: "[Chorus]",
    cue: "Full, soaring",
    lines: ["Neon rain, wash it all away", "Neon rain, I am here to stay", "Colors running down the glass", "Nothing bright was built to last"],
  },
  {
    tag: "[Verse 2]",
    cue: "",
    lines: [
      "Taxi meters counting every block",
      "Your old jacket hanging by the door",
      "I keep winding back the broken clock",
      "Like the hour means something anymore",
    ],
  },
  {
    tag: "[Chorus]",
    cue: "Full, soaring",
    lines: ["Neon rain, wash it all away", "Neon rain, I am here to stay", "Colors running down the glass", "Nothing bright was built to last"],
  },
  { tag: "[Outro]", cue: "Fade out", lines: [] },
];

const BLEND: Json = {
  confidence: { level: "high", note: "Test answer: both artists are well known." },
  genre: "Dark synthpop",
  tempo: "88-96 BPM, steady",
  instrumentation: "Analog bass, drum machine, arpeggiated synths",
  vocals: "Breathy female alto, close-mic",
  mood: "Melancholic, cinematic",
  styleTag: TAGS,
  styleBriefParts: PARTS,
  voiceTags: "[Female Vocal]",
  vocalPrompt: { voice: "breathy alto", delivery: "close-mic, half-spoken verses", harmonies: "light doubles in the chorus", effects: "plate reverb" },
  excludeStyles: "autotune, trap hi-hats, EDM drop, country twang",
  contradictions: [],
  reconciliation: "Test answer: the darker artist sets the mood and the brighter one sets the hooks.",
  recommendedSliders: { energy: 55, complexity: 45, brightness: 40 },
  sliderNotes: "Test answer: moderate energy suits the mood.",
};

function answer(task: string, payload: Json): Json {
  switch (task) {
    case "blend":
    case "song":
      return BLEND;
    case "lyrics":
      return { title: "Neon Rain", sections: SECTIONS };
    case "regenSection":
      return { tag: "[Chorus]", lines: ["Neon rain, fall on me tonight", "Neon rain, turn the dark to light", "Colors running down the glass", "Nothing bright was built to last"] };
    case "regenLine":
      return { line: "Shadows lean across the empty street" };
    case "intent":
      return {
        reply: "Test answer: I set up a dark synthpop blend.",
        artist_1: "Test Artist One",
        artist_2: "Test Artist Two",
        artist_3: "",
        target_genre: "synthpop",
        era: "modern",
        energy: 55,
        complexity: 45,
        brightness: 40,
      };
    case "compare":
      return { summary: "Test answer: moody and cinematic.", artists: [{ name: "Test Artist One", match: 82, reasoning: ["Similar synths", "Similar mood"] }] };
    case "critique":
      return {
        verdict: "Test answer: a clear hook, but the verses repeat the same image.",
        scores: [
          { label: "Hook", score: 8, note: "Memorable" },
          { label: "Imagery", score: 6, note: "Some worn phrases" },
        ],
        cliches: [{ line: "Nothing bright was built to last", why: "Common phrase", fix: "Every spark forgets the glass" }],
        prosody: [],
        fixFirst: ["Give verse 2 a new image."],
      };
    case "fixTake":
      return {
        fixRoute: "regenerate",
        routeWhy: "Test answer: the vocal placement is set by the prompt.",
        sunoEdits: [],
        diagnosis: "Test answer: the vocal sits behind the synths.",
        changes: [{ change: "Placed the vocal upfront", why: "Buried vocals" }],
        styleTag: `${TAGS}, vocal upfront`,
        excludeStyles: "buried vocals, distant vocals",
        lyricFixes: [],
        tryNext: "Generate three takes before judging.",
      };
    case "variants":
      return {
        variants: ["Safe", "Experimental", "Hybrid"].map((label) => ({
          label,
          angle: `Test answer: the ${label.toLowerCase()} take.`,
          styleTag: `${TAGS}, ${label.toLowerCase()}`,
          excludeStyles: "autotune",
          vocalLine: "breathy alto, close and upfront",
        })),
      };
    case "dossier":
      return {
        titleOptions: ["Neon Rain", "Glass City", "Upside Down"],
        coverArtPrompt: "Test answer: rain on a city window at night, neon reflections.",
        coverArtAlt: "Rain on a window with neon light",
        metadata: { primaryGenre: "Electronic", secondaryGenre: "Synthpop", moods: ["Melancholic"], bpm: "92", key: "A minor", explicit: false, language: "English" },
        shortDescription: "Test answer: a rainy-night synthpop song.",
        bio: "Test answer: a short bio.",
        playlistPitch: "Test answer: for late-night drives.",
        socialHooks: [{ platform: "TikTok", hook: "Rain sounds plus the chorus", clip: "0:42-0:57" }],
        hashtags: ["synthpop", "newmusic"],
        releaseTips: ["Pitch to playlists four weeks ahead."],
      };
    case "refine": {
      if (payload["splitBrief"] || payload["convertTo"] === "brief") return { styleBriefParts: PARTS };
      if (payload["convertTo"] === "tags") return { styleTag: TAGS };
      return { genre: "Dark synthpop", styleTag: `${TAGS}, warmer`, excludeStyles: "autotune", changes: ["Test answer: made it warmer."] };
    }
    case "masterSuggest":
      return { preset: "Streaming Ready", adjustments: {}, reasoning: "Test answer: a balanced track.", warnings: [] };
    default:
      return {};
  }
}

export const isFakeAi = (env: Record<string, string | undefined>) => env["BB_FAKE_AI"] === "1";

/** Stands in for the real `ask` (call the model, parse its JSON). */
export function fakeAsk(task: string, payload: Json) {
  return async (_prompt: string): Promise<Json> => structuredClone(answer(task, payload));
}
