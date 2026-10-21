import { createFileRoute } from "@tanstack/react-router";

import { FREE_TOOLS, ToolLayout } from "@/components/tools/ToolLayout";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/tools/")({
  head: () => ({
    meta: [
      { title: `Free Suno tools: BPM & key finder, lyric checker, metatags | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Free tools for Suno users. Find a song's BPM and key, check lyrics for clichés and words Suno sings wrong, look up metatags, and check a song before release. No account.",
      },
    ],
  }),
  component: ToolsIndex,
});

function ToolsIndex() {
  return (
    <ToolLayout
      title="Free tools for Suno"
      lede="No account and no AI key needed. Audio stays in your browser."
      cta={{
        text: "Want a full Suno prompt, lyrics written for you, or a fix for a bad take? The studio does that, free on your own AI key.",
        href: "/studio",
        label: "Open the studio",
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {FREE_TOOLS.map((t) => (
          <a key={t.to} href={t.to} className="rounded-xl border border-border bg-card/40 p-5 transition-colors hover:border-primary">
            <h2 className="font-display text-lg font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
          </a>
        ))}
      </div>
    </ToolLayout>
  );
}
