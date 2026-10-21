/**
 * Release checklist for Suno songs. Shared by the studio's Release Kit and the free
 * /tools/release-checklist page. Links go to Suno's own help pages rather than restating
 * their terms, which change.
 */
const SUNO_HELP = "https://help.suno.com/en/articles/";

export const RELEASE_CHECKLIST: Array<{ title: string; body: string; links?: Array<[string, string]> }> = [
  {
    title: "Check which Suno plan you made the song on",
    body: "Songs made on the free plan are for non-commercial use and can't be monetized. Subscribing later doesn't automatically change that for songs you already made.",
    links: [
      ["Free plan rights", `${SUNO_HELP}9601601`],
      ["Songs made before subscribing", `${SUNO_HELP}2425729`],
    ],
  },
  {
    title: "Read Suno's rules on streaming and ownership",
    body: "Before uploading to Spotify, Apple Music or YouTube, read what Suno says about distribution and who owns the song.",
    links: [
      ["Distributing to Spotify and others", `${SUNO_HELP}2410177`],
      ["Do I have the copyright?", `${SUNO_HELP}2746945`],
      ["Does Suno own my music?", `${SUNO_HELP}2416769`],
    ],
  },
  {
    title: "Answer your distributor's AI questions honestly",
    body: "Many distributors ask whether a track was made with AI. Check their policy before you upload.",
  },
  {
    title: "Keep real artist names out of your title and credits",
    body: "Don't title a song after an artist or list them as a featured performer. Describe the sound, not the person.",
  },
  {
    title: "Master for streaming",
    body: "Run the song through Mastering with the \"Streaming ready\" preset so it isn't quieter or harsher than everything around it.",
  },
  {
    title: "Keep a record of how you made it",
    body: "Your take log keeps each prompt, rating and Suno link. Signed in, it's saved with the song.",
  },
];

