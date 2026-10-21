import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/brand";

export const FREE_TOOLS = [
  {
    to: "/tools/bpm-key-finder",
    title: "BPM & Key Finder",
    body: "Drop a song to get its tempo, key, sections with bar counts, and tone. Runs in your browser.",
  },
  {
    to: "/tools/lyric-checker",
    title: "Suno Lyric Checker",
    body: "Paste lyrics to catch AI clichés, words Suno sings wrong and lines that won't fit.",
  },
  {
    to: "/tools/suno-metatags",
    title: "Suno Metatag Reference",
    body: "Section, vocal and instrumental tags, where to put them and what they do.",
  },
  {
    to: "/tools/release-checklist",
    title: "Release Checklist",
    body: "What to check before putting a Suno song on Spotify, Apple Music or YouTube.",
  },
] as const;

/** Page shell for the free tools: no account, no AI key. */
export function ToolLayout({
  title,
  lede,
  children,
  cta,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  /** Where the studio can take this further. */
  cta?: { text: string; href: string; label: string } | undefined;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <Link to="/" className="font-display text-lg font-bold">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/tools" className="text-muted-foreground hover:text-foreground">
            Free tools
          </Link>
          <Link to="/guides" className="text-muted-foreground hover:text-foreground">
            Guides
          </Link>
          <a href="/studio" className="rounded-md border border-border px-3 py-2 hover:border-primary">
            Open the studio
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Link to="/tools" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All free tools
        </Link>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{lede}</p>
        <div className="mt-8">{children}</div>
        {cta ? (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="max-w-xl text-sm">{cta.text}</p>
            <a href={cta.href} className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              {cta.label}
            </a>
          </div>
        ) : null}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          {APP_NAME} · Free, no account needed for these tools · Not affiliated with Suno.
        </div>
      </footer>
    </div>
  );
}
