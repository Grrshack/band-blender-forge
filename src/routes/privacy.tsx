import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy — ${APP_NAME}` },
      {
        name: "description",
        content: `What ${APP_NAME} and its browser extension store, what they send, and what they never collect.`,
      },
    ],
  }),
  component: Privacy,
});

const UPDATED = "October 31, 2026";

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "The short version",
    body: [
      `${APP_NAME} is a free helper for writing and finishing Suno songs. Your audio never leaves your browser, your AI key is never saved to an account, and we don't sell or share anything about you.`,
    ],
  },
  {
    heading: "The browser extension",
    body: [
      `The "${APP_NAME}: Send to Suno" extension carries the title, style, exclude list and lyrics you choose to send from ${APP_NAME} into Suno's Create page (or the prompt box in Gemini or ElevenLabs Music), and checks Suno's Style, Exclude and Lyrics boxes as you type.`,
      "When you press Send, that text is held in your browser's extension storage until you fill the boxes or dismiss the panel, then it's deleted. The live check reads only those boxes, on your screen, and changes them only when you press Fix. Nothing is ever sent to us or to anyone else.",
      "The extension runs only on the Band Blender site, suno.com, gemini.google.com and elevenlabs.io. It doesn't read your songs, library, account details or browsing history, it collects no analytics, and it never presses Create or Send for you. You can turn the live check off in the extension's options.",
      "The extension's use of this information adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. It is used only to fill Suno's fields, never sold, never shared and never used for advertising.",
    ],
  },
  {
    heading: "Audio",
    body: [
      "Mastering, Lyric Check, Analyze a Song, Compare Songs, Promo Clips and the other audio tools process files inside your browser. Your audio is not uploaded to our servers, and Mastering clears it when your session ends.",
    ],
  },
  {
    heading: "AI requests and your key",
    body: [
      "AI features use your own Google or Anthropic key. Your request, including the key, passes through our server to that provider and back; we don't store the key or the request. By default the key stays in this browser tab only; if you choose \"remember\", it's kept in this browser's local storage, never in your account.",
      "Cover Maker's image requests go straight from your browser to Google. The provider's own terms and privacy policy apply to what you send them.",
    ],
  },
  {
    heading: "Accounts and saved songs",
    body: [
      "Signing in is optional. If you sign in, we store your email address and the songs, takes and settings you choose to save so they sync across devices. You can delete saved songs at any time, or ask us to delete your account.",
      "Without an account, your work stays in this browser's local storage.",
    ],
  },
  {
    heading: "Feedback and sharing",
    body: [
      "Anything you send through Send feedback, or choose to share publicly (genre cards, shared recipes, community prompts), is stored so we can read it or show it to others.",
    ],
  },
  {
    heading: "Usage counts",
    body: [
      "To see which tools people use, we record anonymous counts: an event name, a short detail such as which tab, and a random id that disappears when you close the tab. No user id, cookies, lyrics, prompts or audio. This is skipped entirely if your browser sends Do Not Track or Global Privacy Control.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions or deletion requests: use Send feedback in the studio, and we'll reply to the email you include.",
    ],
  },
];

function Privacy() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to {APP_NAME}
        </Link>
        <h1 className="font-display text-3xl font-bold">Privacy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}. Covers the website and the browser extension.</p>
        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
