import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { APP_NAME } from "@/lib/brand";
import { GENRE_PAGES } from "@/lib/genre-pages";

export const Route = createFileRoute("/genres/")({
  head: () => ({
    meta: [
      { title: `Suno prompts by genre and use — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Copy-ready Suno style prompts for hip-hop, pop, rock, EDM, R&B, jazz, country, metal and more, plus prompts for podcasts, study music, sleep and trailers.",
      },
    ],
  }),
  component: GenresIndex,
});

function GenresIndex() {
  const genres = GENRE_PAGES.filter((p) => p.kind === "genre");
  const uses = GENRE_PAGES.filter((p) => p.kind === "use");
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to {APP_NAME}
        </Link>
        <h1 className="font-display text-3xl font-bold">Suno prompts by genre</h1>
        <p className="mt-2 text-muted-foreground">
          What to put in Suno's Style and Exclude boxes for each sound: tempo, instruments, vocals, prompts you can copy and check, and
          the words that make the difference.
        </p>
        <PageGrid label="Genres" pages={genres} />
        <PageGrid label="Music for a purpose" pages={uses} />
      </div>
    </div>
  );
}

function PageGrid({ label, pages }: { label: string; pages: typeof GENRE_PAGES }) {
  return (
    <section className="mt-8" aria-label={label}>
      <h2 className="mb-3 font-display text-lg font-semibold">{label}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <li key={p.slug}>
            <Link
              to="/genres/$slug"
              params={{ slug: p.slug }}
              className="panel-surface flex h-full items-start gap-3 p-4 transition-colors hover:border-primary/50"
            >
              <span className="text-2xl" aria-hidden="true">
                {p.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold">{p.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{p.lede.split(".")[0]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
