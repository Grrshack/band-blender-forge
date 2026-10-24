/**
 * Public how-to guides. Each answers one problem Suno users search for and ends at the tool
 * that solves it. Facts that come from other sites carry their source; review these when
 * Suno changes models or plans. Last checked: Oct 24, 2026.
 */
export type GuideSection = { heading: string; body: string[] };
export type Guide = {
  slug: string;
  title: string;
  description: string;
  sections: GuideSection[];
  tool: { tab: string; label: string };
  sources: Array<{ label: string; url: string }>;
};

export const GUIDES: Guide[] = [
  {
    slug: "fix-muffled-suno-song",
    title: "Why your Suno song sounds muffled, and what actually fixes it",
    description:
      "Suno v6 songs often come out dull, boomy or with buried vocals. Here's what mastering can fix, what it can't, and what to do instead.",
    sections: [
      {
        heading: "What's going on",
        body: [
          "Many people describe Suno v6 output as muffled or flat, with buried vocals and a weak top end. Measurements of matched v5.5 and v6 songs found v6 carries more energy below 120 Hz and a noisier top octave.",
          "Some of that is in the mix balance, which mastering can adjust. Some of it is baked into how the song was generated, which no mastering can change.",
        ],
      },
      {
        heading: "What mastering can fix",
        body: [
          "Overall loudness: about −14 LUFS with peaks under −1 dB for Spotify.",
          "Boomy or rumbling low end: tighten it and keep the bass mono, rather than cutting it with a high-pass filter.",
          "Muddy build-up around 200–500 Hz: a small cut of 1–3 dB.",
        ],
      },
      {
        heading: "What it can't fix",
        body: [
          "Buried vocals: EQ lifts everything in the vocal range. Edit that section in Suno, or rebalance stems.",
          "A missing top end: boosting the highs mostly raises noise.",
          "Shimmer, warbling or garbled words: regenerate or edit that part in Suno.",
          "Squashed dynamics: once the loud and quiet parts are flattened, a master can't bring them back.",
        ],
      },
      {
        heading: "What to do, in order",
        body: [
          "1. Load the song in Mastering. You get a verdict that labels each problem as fixable here or not.",
          "2. For anything mastering can't fix, open Fix a Track. It writes a plain-language edit you can paste into Suno v6, which changes one section and keeps the rest.",
          "3. Master what's left with the Suno v6 starter preset, then export at −14 LUFS.",
        ],
      },
    ],
    tool: { tab: "master", label: "Open Mastering" },
    sources: [
      { label: "TrackGleam: Suno v6 mastering", url: "https://trackgleam.com/learn/suno-v6-mastering" },
      { label: "Replayed Studio: Suno artifacts and mastering", url: "https://replayedstudio.com/blog/why-suno-song-sounds-bad/" },
    ],
  },
  {
    slug: "suno-v6-style-prompt",
    title: "Writing a Suno v6 style prompt that works",
    description:
      "Genre first, one tempo, 8–12 strong tags, negatives in Exclude styles. A short checklist for v6, v6-mini and v6-wild.",
    sections: [
      {
        heading: "Pick the right model",
        body: [
          "Suno's v6 family has three models: v6-mini (available on every plan, including free), v6 (the flagship) and v6-wild (less predictable by design). v6 and v6-wild need a Pro or Premier plan.",
          "v6-mini responds best to short, direct prompts. v6 understands musician vocabulary and natural phrases. For v6-wild, anchor genre, tempo and mood clearly, then leave room for surprise.",
        ],
      },
      {
        heading: "The checklist",
        body: [
          "Put the genre first. The opening tags carry the most weight.",
          "Give one tempo, such as \"92 bpm\". Two tempos pull against each other.",
          "Keep to the strongest 8–12 tags. Long lists dilute each other.",
          "Avoid opposites (calm and aggressive, acoustic and EDM) unless you say how they fit: \"slow verses, explosive chorus\".",
          "Put negatives like \"no drums\" in Exclude styles, not the style box.",
          "Describe the sound, never name an artist. Suno blocks artist names.",
        ],
      },
      {
        heading: "Check before you generate",
        body: [
          "The Export Sheet runs these checks on your prompt instantly, so you don't spend a generation, or one of your limited downloads, on a prompt that was never going to work.",
        ],
      },
    ],
    tool: { tab: "suno", label: "Open the Export Sheet" },
    sources: [{ label: "Suno: Introducing v6", url: "https://suno.com/blog/introducing-v6" }],
  },
  {
    slug: "suno-download-limits",
    title: "Making the most of Suno's download limits",
    description:
      "Since September 2026 Suno limits downloads: 7 ever on the free plan, 20 a month on Pro, 60 on Premier. How to spend them only on keepers.",
    sections: [
      {
        heading: "The limits",
        body: [
          "Free: up to 7 lifetime trial downloads, for personal, non-commercial use. Pro: 20 downloads a month. Premier: 60 a month.",
          "A song's stems come with its download, and downloading the same song again doesn't count twice. Streaming and sharing links stay unlimited. Suno Studio workflows aren't affected.",
        ],
      },
      {
        heading: "Judge takes before you download",
        body: [
          "Listen on Suno and rate each take in the Take Log. Note where problems happen (\"1:32, vocal goes robotic\").",
          "Fix a Track works from those notes alone, no file needed. It suggests whether to edit the take in Suno, regenerate, or just master it.",
          "Prefer Suno v6's edit feature for local problems: change one section or one line and keep the rest, instead of rolling the dice on a whole new take.",
        ],
      },
      {
        heading: "Download the keeper",
        body: [
          "Mark it as downloaded in the Take Log so your song shows how many you've used. Then master it once, properly.",
        ],
      },
    ],
    tool: { tab: "fix", label: "Open Fix a Track" },
    sources: [
      { label: "Suno: How many downloads come with my subscription?", url: "https://help.suno.com/en/articles/13926209" },
      { label: "Suno: Upcoming changes FAQ", url: "https://help.suno.com/en/articles/13614785" },
    ],
  },
  {
    slug: "fix-suno-pronunciation",
    title: "Fixing words Suno sings wrong",
    description:
      "Numbers, symbols, abbreviations and words with two pronunciations trip up AI singers. Respell them the way they should sound.",
    sections: [
      {
        heading: "The usual culprits",
        body: [
          "Digits: write \"twenty-four seven\", not \"24/7\"; \"three A.M.\", not \"3am\".",
          "Symbols: write \"and\" for \"&\", \"percent\" for \"%\".",
          "Abbreviations: separating the letters (\"D.J.\" rather than \"DJ\") helps them come out as letters.",
          "Words with two pronunciations: live, read, lead, tear, wind, wound, bass, bow, dove, desert, minute, close. If one comes out wrong, respell it the way it sounds.",
        ],
      },
      {
        heading: "Let the app flag them",
        body: [
          "Lyric Forge marks lines with these risks with a SAY badge and suggests a respelling. Fix them before you generate so the first take has a chance.",
        ],
      },
    ],
    tool: { tab: "lyrics", label: "Open Lyric Forge" },
    sources: [],
  },
  {
    slug: "suno-from-your-own-beat",
    title: "Starting a Suno song from your own beat",
    description:
      "Make a beat with a free browser tool, then upload it to Suno or describe it in your style prompt.",
    sections: [
      {
        heading: "Make the beat",
        body: [
          "Free tools that export WAV and MIDI without an account: BAP Studio (bap.studio) and the Beat Machine at emusic.tools. BandLab's free online studio also has a drum machine and loops (account needed).",
          "Those sites don't spell out the rights to exported beats. If you plan to release the song, build from their basic drum sounds rather than someone else's samples.",
        ],
      },
      {
        heading: "Upload it to Suno",
        body: [
          "Suno's Upload Audio button sits next to Create. Free accounts can upload up to 60 seconds; Pro and Premier up to 8 minutes. Then use Extend to continue it into a song, or Cover to remake it in a new style.",
          "Only upload audio you made or own. Suno asks you to confirm that, and blocks copyrighted works.",
        ],
      },
      {
        heading: "Or describe it (any plan)",
        body: [
          "Drop the beat into Start here → Start from a beat. It estimates the tempo in your browser and builds a line like \"92 bpm, boom-bap drums, swung shuffle\" for your style prompt.",
        ],
      },
    ],
    tool: { tab: "assistant", label: "Open Start here" },
    sources: [
      { label: "Suno: How to use audio uploads", url: "https://help.suno.com/en/articles/6141569" },
      { label: "Suno: What does Upload Audio do?", url: "https://help.suno.com/en/articles/2477633" },
    ],
  },
  {
    slug: "sketch-in-gemini-finish-in-suno",
    title: "Sketch a song in Gemini, finish it in Suno",
    description:
      "Use Google's free Lyria 3.5 in the Gemini app to try ideas, then upload the one you like to Suno to extend or cover it.",
    sections: [
      {
        heading: "Why use both",
        body: [
          "Google's Lyria 3.5 music model is in the Gemini app for everyone, and in Google Flow Music. You describe a song and get about two minutes of music with vocals. It's a quick, free way to hear an idea.",
          "Suno is where you finish: longer songs, editing parts of a take, covers and extends. Suno's downloads are limited by plan, so trying ideas elsewhere first saves them for keepers.",
        ],
      },
      {
        heading: "How they differ",
        body: [
          "Lyria 3.5 (Gemini, Flow Music): one plain-English request with lyrics inside it; songs of about two minutes; it can't edit a song after making it; every track carries Google's invisible SynthID watermark; prompts asking for an artist's voice or known lyrics are blocked.",
          "Suno v6: separate Style and Lyrics boxes plus Exclude styles; longer songs; edit, extend, cover and replace sections; three models (v6-mini on the free plan, v6 and v6-wild on Pro and Premier).",
          "They sound different. A sketch you like in Gemini tells you the idea works, not exactly how Suno will play it.",
        ],
      },
      {
        heading: "The workflow",
        body: [
          "1. Build the sound and lyrics in Band Blender, then open the Export Sheet and pick the Gemini / Flow tab. Copy that prompt into the Gemini app's music option or Flow Music.",
          "2. Generate a few versions and download the one you like.",
          "3. In Suno, press Upload Audio next to Create. Free plans take up to 60 seconds, so trim to the best part; Pro and Premier take up to 8 minutes.",
          "4. Use Cover to remake it with your Suno style prompt, or Extend to continue it. Paste the Suno style and lyrics from the Export Sheet's Suno tab.",
        ],
      },
      {
        heading: "Before you release anything",
        body: [
          "Check the rights on both sides. Google's commercial-use terms differ by plan, and a free Gemini account may not include them. Suno asks you to confirm you have the right to use anything you upload.",
          "If Suno won't accept an upload, describe the sketch in your style prompt instead: Analyze a Song can measure its tempo, key and sections for you.",
        ],
      },
    ],
    tool: { tab: "suno", label: "Open the Export Sheet" },
    sources: [
      { label: "Google: Lyria 3.5 in Flow Music", url: "https://blog.google/innovation-and-ai/models-and-research/google-labs/lyria-3-5/" },
      { label: "Gemini API: music generation with Lyria 3.5", url: "https://ai.google.dev/gemini-api/docs/music-generation" },
      { label: "Digital Trends: Lyria 3.5 in the Gemini app", url: "https://www.digitaltrends.com/computing/google-brings-its-best-ai-music-model-lyria-3-5-to-the-gemini-app/" },
      { label: "Suno: How to use audio uploads", url: "https://help.suno.com/en/articles/6141569" },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
