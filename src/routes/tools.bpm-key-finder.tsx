import { createFileRoute } from "@tanstack/react-router";

import { SongDrop, SongMeasurements, useSongAnalysis } from "@/components/forge/SongMeasurements";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/tools/bpm-key-finder")({
  head: () => ({
    meta: [
      { title: `Free BPM & Key Finder for Suno | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Find any song's tempo (BPM), key, sections with bar counts, loudness and tone, free in your browser. The file is never uploaded. Copy the result into your Suno prompt.",
      },
    ],
  }),
  component: BpmKeyFinder,
});

function BpmKeyFinder() {
  const { analysis, fileName, busy, error, analyze } = useSongAnalysis();
  return (
    <ToolLayout
      title="BPM & Key Finder"
      lede="Drop a song to get its tempo, key, sections with bar counts, loudness and tone. Everything runs in your browser; the file is never uploaded."
      cta={{
        text: "Turn this song into a Suno prompt in the same style, or write lyrics that fit its structure. Free in the studio on your own AI key.",
        href: "/studio?tab=analyze",
        label: "Analyze it in the studio",
      }}
    >
      <div className="max-w-3xl space-y-5">
        <SongDrop onFile={(f) => void analyze(f)} busy={busy} />
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}
        {analysis ? <SongMeasurements analysis={analysis} fileName={fileName} /> : null}
        <div className="space-y-2 text-sm text-muted-foreground">
          <h2 className="font-display text-lg font-semibold text-foreground">How accurate is it?</h2>
          <p>
            Tempo is reliable on songs with a steady beat. It may read half or double the true tempo, so both are
            shown. Key detection works best on songs that stay in one key; the confidence and the next most
            likely key are shown so you can judge. Sections are found from changes in loudness, so their names are
            guesses.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
