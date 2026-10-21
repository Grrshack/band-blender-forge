import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ToolLayout } from "@/components/tools/ToolLayout";
import { APP_NAME } from "@/lib/brand";
import { RELEASE_CHECKLIST } from "@/lib/release-checklist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tools/release-checklist")({
  head: () => ({
    meta: [
      { title: `Suno Release Checklist: before Spotify, Apple Music or YouTube | ${APP_NAME}` },
      {
        name: "description",
        content:
          "What to check before releasing a song made with Suno: your plan's rights, Suno's distribution rules, distributor AI questions, credits and mastering. Links go to Suno's own help pages.",
      },
    ],
  }),
  component: ReleaseChecklistPage,
});

function ReleaseChecklistPage() {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <ToolLayout
      title="Release Checklist for Suno Songs"
      lede="Tick through these before uploading to Spotify, Apple Music or YouTube. Not legal advice: Suno's terms change, so the links go to their own pages."
      cta={{
        text: "Master the song for streaming in your browser, and get cover art prompts, metadata and social copy in the Release Kit.",
        href: "/studio?tab=dossier",
        label: "Open the Release Kit",
      }}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {done.size} of {RELEASE_CHECKLIST.length} done
      </p>
      <ol className="max-w-3xl space-y-3">
        {RELEASE_CHECKLIST.map((item, i) => {
          const on = done.has(i);
          return (
            <li key={item.title} className={cn("rounded-lg border p-4", on ? "border-emerald-500/40 bg-emerald-500/5" : "border-border")}>
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setDone((d) => {
                      const n = new Set(d);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                </span>
              </label>
              {item.links?.length ? (
                <div className="mt-2 flex flex-wrap gap-3 pl-7 text-sm">
                  {item.links.map(([label, href]) => (
                    <a key={href} href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                      {label}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ToolLayout>
  );
}
