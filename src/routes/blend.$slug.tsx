import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSharedBlend } from "@/lib/forge.functions";
import { PromptCard } from "@/components/forge/PromptCard";
import type { BlendResult } from "@/components/forge/types";

export const Route = createFileRoute("/blend/$slug")({
  head: () => ({
    meta: [
      { title: "Shared Blend — Band Blender Forge" },
      { name: "description", content: "A shared style prompt from Band Blender Forge." },
    ],
  }),
  component: SharedBlendPage,
});

function SharedBlendPage() {
  const { slug } = Route.useParams();
  const fetch = useServerFn(getSharedBlend);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artists, setArtists] = useState<string[]>([]);
  const [result, setResult] = useState<BlendResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const row = await fetch({ data: { slug } });
        setArtists(row.artists ?? []);
        setResult(row.blend_data as BlendResult);
      } catch {
        setError("This blend link doesn't exist or has been removed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to Band Blender Forge
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link
              to="/"
              className="mt-4 inline-block font-mono text-xs text-primary underline underline-offset-2"
            >
              Make your own blend →
            </Link>
          </div>
        )}

        {!loading && !error && result && (
          <>
            <p className="mb-4 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Shared blend · {artists.join(" × ")}
            </p>
            {/* Inline card — not in a modal, rendered directly on the page */}
            <SharedBlendCard artists={artists} result={result} slug={slug} />
          </>
        )}
      </div>
    </div>
  );
}

/** Renders the blend card inline (no modal, since this IS the page). */
function SharedBlendCard({
  artists,
  result,
  slug,
}: {
  artists: string[];
  result: BlendResult;
  slug: string;
}) {
  // Reuse PromptCard's card body without the modal wrapper by triggering onClose as a no-op
  // and passing the slug so the "Copy link" button is always visible.
  return (
    <PromptCard
      inline
      data={{ artists, result, cardTitle: artists.join(" × ") }}
      shareSlug={slug}
      onClose={() => { window.location.href = "/"; }}
    />
  );
}
