import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { APP_NAME } from "@/lib/brand";
import { GUIDES } from "@/lib/guides";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title: `Suno guides — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Short, practical guides for Suno users: fix a muffled song, write a v6 style prompt, save downloads, fix pronunciation, start from your own beat.",
      },
    ],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to {APP_NAME}
        </Link>
        <h1 className="font-display text-3xl font-bold">Guides for Suno users</h1>
        <p className="mt-2 text-muted-foreground">
          Short answers to the problems people hit most, each ending at the tool that fixes it.
        </p>
        <ul className="mt-8 space-y-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: g.slug }}
                className="panel-surface flex items-start gap-3 p-5 transition-colors hover:border-primary/50"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{g.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
