import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { guideBySlug } from "@/lib/guides";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }) => {
    const guide = guideBySlug(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${APP_NAME}` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.description },
        ]
      : [{ title: `Guide not found — ${APP_NAME}` }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background px-4 py-10 text-center">
      <p className="text-muted-foreground">That guide doesn't exist.</p>
      <Link to="/guides" className="mt-3 inline-block text-primary underline">
        All guides
      </Link>
    </div>
  ),
  component: GuidePage,
});

function GuidePage() {
  const g = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl">
        <Link to="/guides" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All guides
        </Link>
        <h1 className="font-display text-3xl leading-tight font-bold">{g.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{g.description}</p>

        {g.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
            <div className="mt-2 space-y-2.5">
              {s.body.map((p) => (
                <p key={p} className="leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        <div className="panel-surface mt-10 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-foreground/90">Free, runs in your browser, no account needed to try.</p>
          <Button asChild className="gap-1.5">
            <a href={`/?tab=${g.tool.tab}`}>
              {g.tool.label} <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>

        {g.sources.length ? (
          <section className="mt-8 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Sources</h2>
            <ul className="mt-2 space-y-1">
              {g.sources.map((src) => (
                <li key={src.url}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
                  >
                    {src.label} <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Last checked October 2026.</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
