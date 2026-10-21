import { createFileRoute } from "@tanstack/react-router";

import { CopyButton } from "@/components/forge/CopyButton";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { APP_NAME } from "@/lib/brand";
import { METATAG_GROUPS, METATAG_TIPS } from "@/lib/metatags";

export const Route = createFileRoute("/tools/suno-metatags")({
  head: () => ({
    meta: [
      { title: `Suno Metatag Reference: section, vocal and instrumental tags | ${APP_NAME}` },
      {
        name: "description",
        content:
          "A plain list of Suno lyric tags ([Verse], [Chorus], [Bridge], [Drop], [Female Vocal], [Whisper] and more), what each does and where to put it. Copy any tag in one click.",
      },
    ],
  }),
  component: Metatags,
});

function Metatags() {
  return (
    <ToolLayout
      title="Suno Metatag Reference"
      lede="Bracket tags in your lyrics tell Suno what each part is and how to sing it. Suno treats them as hints, not commands: they raise the odds, they don't guarantee it."
      cta={{
        text: "Lyric Forge writes lyrics with the section tags already in place, sized to the length you want.",
        href: "/studio?tab=lyrics",
        label: "Open Lyric Forge",
      }}
    >
      <div className="space-y-8">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {METATAG_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {METATAG_GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="font-display text-xl font-semibold">{g.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{g.intro}</p>
            <div className="mt-3 divide-y divide-border rounded-lg border border-border">
              {g.tags.map((t) => (
                <div key={t.tag} className="flex items-center gap-3 px-3 py-2.5">
                  <code className="w-40 shrink-0 font-mono text-sm text-primary">{t.tag}</code>
                  <span className="flex-1 text-sm">{t.use}</span>
                  <CopyButton value={t.tag} size="icon" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolLayout>
  );
}
