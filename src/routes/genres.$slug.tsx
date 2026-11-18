import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ClipboardCheck, Shuffle, Zap } from "lucide-react";
import { useEffect, useMemo } from "react";

import { CopyButton } from "@/components/forge/CopyButton";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { genrePageBySlug, type GenrePage as Page } from "@/lib/genre-pages";
import { buildStudioHref } from "@/lib/handoff";
import { CHECKER_IMPORT_KEY, checkPrompt } from "@/lib/prompt-checker";
import { track } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/genres/$slug")({
  loader: ({ params }) => {
    const page = genrePageBySlug(params.slug);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${APP_NAME}` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.description },
        ]
      : [{ title: `Genre not found — ${APP_NAME}` }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background px-4 py-10 text-center">
      <p className="text-muted-foreground">We don't have a page for that genre yet.</p>
      <Link to="/genres" className="mt-3 inline-block text-primary underline">
        All genres
      </Link>
    </div>
  ),
  component: GenrePage,
});

/** Puts a prompt on the studio's Suno Sheet as a new song (the Prompt Checker's handoff). */
function openOnSunoSheet(style: string, exclude: string, from: string) {
  try {
    sessionStorage.setItem(CHECKER_IMPORT_KEY, JSON.stringify({ title: "", style, exclude, lyrics: "", at: Date.now() }));
  } catch {
    /* storage blocked: the studio opens empty */
  }
  track("start_choice", `genre_to_studio:${from}`);
  window.location.href = "/studio?tab=suno&import=checker";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const checkerHref = (style: string, exclude: string) => {
  const q = new URLSearchParams({ style });
  if (exclude) q.set("exclude", exclude);
  return `/tools/suno-prompt-checker?${q.toString()}`;
};

function GenrePage() {
  const p = Route.useLoaderData();
  useEffect(() => {
    track("guide_view", `genre:${p.slug}`, { once: true });
  }, [p.slug]);
  const quickHref = buildStudioHref({ kind: "describe", text: p.describe });

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <Link to="/genres" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All genres
        </Link>
        <h1 className="font-display text-3xl leading-tight font-bold">
          <span aria-hidden="true">{p.emoji} </span>
          {p.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{p.lede}</p>

        {p.facts.length ? (
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            {p.facts.map((f) => (
              <div key={f.label} className="panel-surface p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className="mt-1 text-sm">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <section className="mt-8" aria-label="Starter prompt">
          <h2 className="font-display text-xl font-semibold">A prompt to start from</h2>
          <PromptBox page={p} title="Starter" style={p.prompt.style} exclude={p.prompt.exclude} />
        </section>

        {p.starters.length ? (
          <section className="mt-8" aria-label="More prompts">
            <h2 className="font-display text-xl font-semibold">More {p.kind === "genre" ? p.name.split("/")[0]!.trim().toLowerCase() : ""} prompts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fuller prompts in this family, written for Suno's current models.</p>
            <div className="mt-3 space-y-4">
              {p.starters.map((s) => (
                <PromptBox key={s.title} page={p} title={`${s.title} · ${s.genre}`} style={s.style} exclude={s.exclude} note={capitalize(s.note.replace(/^Starter:\s*/i, ""))} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">What makes the difference</h2>
          <p className="mt-2 leading-relaxed text-foreground/90">{p.notes}</p>
        </section>

        {p.blends.length ? (
          <section className="mt-8" aria-label="Blend ideas">
            <h2 className="font-display text-xl font-semibold">Blend ideas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Suno blocks artist names, so Band Blender turns a blend into a description of the sound. Pick one and the studio writes the
              prompt.
            </p>
            <ul className="mt-3 space-y-2">
              {p.blends.map((b) => {
                const href = buildStudioHref({ kind: "artists", artists: b.artists });
                return (
                  <li key={b.artists.join("+")} className="panel-surface flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{b.artists.join(" × ")}</p>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                    </div>
                    {href ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                        <a href={href} onClick={() => track("start_choice", `genre_blend:${p.slug}`)}>
                          <Shuffle className="size-3.5" /> Blend these
                        </a>
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="panel-surface mt-10 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="font-display font-semibold">Make a whole song in this style</p>
            <p className="text-sm text-muted-foreground">Quick song writes the style and the lyrics, checked and ready to send to Suno.</p>
          </div>
          {quickHref ? (
            <Button asChild className="gap-1.5">
              <a href={quickHref} onClick={() => track("start_choice", `genre_quick:${p.slug}`)}>
                <Zap className="size-4" /> Make my song
              </a>
            </Button>
          ) : null}
        </div>

        <nav aria-label="Related" className="mt-10 border-t border-border pt-5">
          <h2 className="text-sm font-semibold text-muted-foreground">{p.kind === "genre" ? "Other genres" : "Other uses"}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {p.related.map((r) => (
              <li key={r.slug}>
                <Link
                  to="/genres/$slug"
                  params={{ slug: r.slug }}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm hover:border-primary"
                >
                  <span aria-hidden="true">{r.emoji}</span> {r.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/genres" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-primary">
                All genres <ArrowRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        </nav>
      </article>
    </div>
  );
}

function PromptBox({ page, title, style, exclude, note }: { page: Page; title: string; style: string; exclude: string; note?: string }) {
  const report = useMemo(
    () => checkPrompt({ title: "", style, exclude, lyrics: "", artists: [], version: "v6" }),
    [style, exclude],
  );
  const problems = report.issues.filter((i) => i.level !== "tip").length;
  return (
    <div className="panel-surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            problems ? "border-amber-500/40 text-amber-400" : "border-emerald-500/40 text-emerald-400",
          )}
          title="Scored by the free Suno Prompt Checker"
        >
          Checker score {report.score ?? "–"}
        </span>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Style</span>
          <CopyButton value={style} label="Copy" />
        </div>
        <p className="rounded-md border border-border bg-background/60 p-3 font-mono text-sm">{style}</p>
      </div>
      {exclude ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Exclude styles</span>
            <CopyButton value={exclude} label="Copy" />
          </div>
          <p className="rounded-md border border-border bg-background/60 p-3 font-mono text-sm">{exclude}</p>
        </div>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="gap-1.5 text-xs" onClick={() => openOnSunoSheet(style, exclude, page.slug)}>
          Open in the studio <ArrowRight className="size-3.5" />
        </Button>
        <Button asChild size="sm" variant="ghost" className="gap-1.5 text-xs">
          <a href={checkerHref(style, exclude)}>
            <ClipboardCheck className="size-3.5" /> Check and fix it
          </a>
        </Button>
      </div>
    </div>
  );
}
