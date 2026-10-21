/**
 * A reference of bracket tags people use in Suno lyrics. Suno treats them as hints, not
 * commands: they raise the odds of what you ask for but don't guarantee it.
 * Used by the free /tools/suno-metatags page.
 */
export type MetaTag = { tag: string; use: string };
export type MetaTagGroup = { title: string; intro: string; tags: MetaTag[] };

export const METATAG_GROUPS: MetaTagGroup[] = [
  {
    title: "Song sections",
    intro: "Put each on its own line above the lyrics for that part. These are the most reliable tags.",
    tags: [
      { tag: "[Intro]", use: "Opening. Leave it without lyrics for an instrumental intro." },
      { tag: "[Verse]", use: "Storytelling parts. Number them ([Verse 1], [Verse 2]) to keep them distinct." },
      { tag: "[Pre-Chorus]", use: "A short lift that builds into the chorus." },
      { tag: "[Chorus]", use: "The main hook. Repeat the same words each time for a stronger hook." },
      { tag: "[Post-Chorus]", use: "A short tag or chant right after the chorus." },
      { tag: "[Bridge]", use: "A contrasting part, usually before the last chorus." },
      { tag: "[Hook]", use: "A short repeated line; common in hip-hop." },
      { tag: "[Outro]", use: "The ending. Helps avoid songs that stop abruptly." },
      { tag: "[End]", use: "Placed last to encourage a clean finish." },
    ],
  },
  {
    title: "Instrumental and electronic parts",
    intro: "Leave these without lyric lines, or Suno may try to sing over them.",
    tags: [
      { tag: "[Instrumental]", use: "A part with no vocals." },
      { tag: "[Instrumental Break]", use: "A short instrumental gap mid-song." },
      { tag: "[Guitar Solo]", use: "A lead guitar section. Other instruments work too, e.g. [Piano Solo], [Sax Solo]." },
      { tag: "[Build]", use: "Rising tension before a drop or chorus." },
      { tag: "[Drop]", use: "The main electronic payoff after a build." },
      { tag: "[Breakdown]", use: "A stripped-back part with fewer elements." },
      { tag: "[Fade Out]", use: "A gradual ending instead of a hard stop." },
    ],
  },
  {
    title: "Vocals",
    intro: "Put vocal tags at the very top of the lyrics, or above a section to change the voice for that part.",
    tags: [
      { tag: "[Male Vocal]", use: "Asks for a male lead." },
      { tag: "[Female Vocal]", use: "Asks for a female lead." },
      { tag: "[Duet]", use: "Two voices trading or singing together." },
      { tag: "[Choir]", use: "A group of voices." },
      { tag: "[Rap]", use: "Rapped delivery for that part." },
      { tag: "[Spoken Word]", use: "Talking rather than singing." },
      { tag: "[Whisper]", use: "Quiet, breathy delivery." },
      { tag: "[Falsetto]", use: "High, light head voice." },
      { tag: "[Harmonies]", use: "Backing vocal harmonies." },
    ],
  },
  {
    title: "Ad-libs and cues",
    intro: "Small touches inside the lyrics.",
    tags: [
      { tag: "(oh, yeah)", use: "Words in round brackets are usually sung as backing vocals or ad-libs." },
      { tag: "[Soft]", use: "A gentler, quieter delivery for that part." },
      { tag: "[Powerful]", use: "A bigger, belted delivery for that part." },
      { tag: "[Slow]", use: "Asks for a slower feel; works best near an ending or bridge." },
    ],
  },
];

export const METATAG_TIPS: string[] = [
  "Put style, genre and instruments in the Style box, not in brackets in the lyrics.",
  "One tag per line, on its own line, directly above the part it describes.",
  "Fewer tags work better than many. If a tag is ignored, generate again before adding more.",
  "Don't put real artist names in tags; Suno filters them.",
];
