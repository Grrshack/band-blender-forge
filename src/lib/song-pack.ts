/**
 * The Song Pack: one .zip with everything for one song, so nothing gets lost between Band
 * Blender, Suno and the distributor. Text files only, plus the cover if one was exported in
 * this tab. Nothing is uploaded; the zip is built in the browser.
 */
import { getLastCover } from "@/lib/cover-render";
import { activeFormat, exportLyrics } from "@/lib/prompt-craft";
import { disclosureAnswers } from "@/lib/release-check";
import { bpmFrom, clock, sectionTimes } from "@/lib/section-times";
import { composeSunoLyrics, vocalString } from "@/lib/suno";
import { buildZip, type ZipEntry } from "@/lib/zip";
import { exportBrief, type DossierResult, type ForgeState } from "@/components/forge/types";

export const packSlug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "song";

function releaseKit(d: DossierResult): string {
  const out: string[] = ["# Release kit"];
  if (d.titleOptions?.length) out.push(`\n## Title ideas\n${d.titleOptions.map((t) => `- ${t}`).join("\n")}`);
  const m = d.metadata;
  if (m) {
    const rows = [
      m.primaryGenre && `Primary genre: ${m.primaryGenre}`,
      m.secondaryGenre && `Secondary genre: ${m.secondaryGenre}`,
      m.moods?.length && `Moods: ${m.moods.join(", ")}`,
      m.bpm && `BPM: ${m.bpm}`,
      m.key && `Key: ${m.key}`,
      m.language && `Language: ${m.language}`,
      typeof m.explicit === "boolean" && `Explicit: ${m.explicit ? "yes" : "no"}`,
    ].filter(Boolean);
    if (rows.length) out.push(`\n## Metadata\n${rows.join("\n")}`);
  }
  if (d.shortDescription) out.push(`\n## Short description\n${d.shortDescription}`);
  if (d.bio) out.push(`\n## Bio\n${d.bio}`);
  if (d.playlistPitch) out.push(`\n## Playlist pitch\n${d.playlistPitch}`);
  if (d.socialHooks?.length) {
    out.push(
      `\n## Social hooks\n${d.socialHooks
        .map((h) => `- ${h.platform ? `${h.platform}: ` : ""}${h.hook ?? ""}${h.clip ? ` (clip: ${h.clip})` : ""}`)
        .join("\n")}`,
    );
  }
  if (d.hashtags?.length) out.push(`\n## Hashtags\n${d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`);
  if (d.coverArtPrompt) out.push(`\n## Cover art prompt\n${d.coverArtPrompt}`);
  if (d.coverArtAlt) out.push(`Alt text: ${d.coverArtAlt}`);
  if (d.releaseTips?.length) out.push(`\n## Release tips\n${d.releaseTips.map((t) => `- ${t}`).join("\n")}`);
  return out.join("\n") + "\n";
}

function takeLog(state: ForgeState): string {
  const out = ["# Take log"];
  for (const t of state.takes) {
    out.push(
      [
        `\n## ${t.at.slice(0, 16).replace("T", " ")}  ${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}${t.downloaded ? "  (downloaded)" : ""}`,
        t.sunoUrl ? `Link: ${t.sunoUrl}` : "",
        `Style: ${t.style}`,
        t.exclude ? `Exclude: ${t.exclude}` : "",
        t.note ? `Note: ${t.note}` : "",
        t.checks?.lyric ? `Lyric check: ${t.checks.lyric.accuracyPct}% sung as written` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return out.join("\n") + "\n";
}

/** The rough timeline of the lyrics, section by section. */
export function lyricTimeline(state: ForgeState): string {
  const b = state.blend.result;
  const secs = state.lyrics.sections;
  if (!secs.length) return "";
  const t = sectionTimes(secs, { bpm: bpmFrom(b?.tempo, b?.styleTag, b?.styleAlt), plan: state.lyrics.structure });
  const rows = secs.map((s, i) => {
    const x = t.sections[i]!;
    return `${clock(x.start).padStart(5)} – ${clock(x.end).padEnd(5)}  ${s.tag}  (${x.bars} bars)`;
  });
  return [
    `Rough timeline at ${t.bpm} BPM${t.bpmGuessed ? " (no tempo found, so 100 is a guess)" : ""}`,
    `Total ≈ ${clock(t.totalSec)}. An estimate only: Suno decides the real timing.`,
    "",
    ...rows,
    "",
  ].join("\n");
}

/** Every text file in the pack, as [path inside the zip, contents]. Pure, so it can be tested. */
export function songPackFiles(name: string, state: ForgeState): Array<[string, string]> {
  const files: Array<[string, string]> = [];
  const b = state.blend.result;
  const lyrics = state.lyrics;
  const title = lyrics.title.trim() || name;
  const style = b?.styleTag?.trim() ?? "";
  const format = activeFormat(b);
  const other = format === "brief" ? "tags" : "brief";
  const raw = lyrics.sections.length ? composeSunoLyrics(lyrics.sections) : "";
  const sung = raw ? exportLyrics(raw, lyrics.cleanEnding !== false).text : "";

  const listed: string[] = [];
  const add = (path: string, text: string, what: string) => {
    if (!text.trim()) return;
    files.push([path, text.endsWith("\n") ? text : `${text}\n`]);
    listed.push(`  ${path.padEnd(30)} ${what}`);
  };

  add("suno/title.txt", title, "paste into Suno's Title box");
  add("suno/style.txt", style, `paste into Suno's Style box (${format === "brief" ? "Studio Brief" : "tag list"})`);
  if (b?.styleAlt?.trim())
    add(`suno/style-${other}.txt`, b.styleAlt, `the same style as a ${other === "brief" ? "Studio Brief" : "tag list"}`);
  add("suno/exclude.txt", b?.excludeStyles ?? "", "paste into Exclude Styles");
  add("suno/lyrics.txt", sung, "paste into Lyrics (clean ending included when it fits)");
  const vocal = vocalString(b?.vocalPrompt);
  if (vocal) add("suno/vocal.txt", vocal, "the vocal description on its own");
  add("lyrics/timeline.txt", lyricTimeline(state), "rough start time of each section");
  add("lyrics/lyrics.lrc", state.release?.lrc ?? "", "synced lyrics for Spotify, Apple Music, Musixmatch");
  if (state.dossiers[0]) add("release/release-kit.md", releaseKit(state.dossiers[0]), "bio, pitch, hashtags, metadata");
  let answers: Array<{ where: string; answer: string }> = [];
  try {
    answers = disclosureAnswers(state.release?.disclosure ?? {});
  } catch {
    // An old or hand-edited save with an unknown level; skip this file rather than the pack.
  }
  if (answers.length)
    add(
      "release/ai-disclosure.txt",
      answers.map((a) => `${a.where}\n${a.answer}`).join("\n\n"),
      "what to answer about AI on each distributor",
    );
  if (state.takes.length) add("notes/take-log.md", takeLog(state), "your takes, ratings and notes");
  add("brief.md", exportBrief(name, state), "the full brief (same as Copy brief)");

  const readme = [
    `${title}`,
    `Song pack from Band Blender, ${new Date().toISOString().slice(0, 10)}`,
    "",
    "What's inside:",
    ...listed,
    "",
    "The cover is included only if you exported one from the Cover Maker in this tab.",
    "Audio is never stored by Band Blender, so your Suno takes and masters are not in here.",
    "",
  ].join("\n");
  return [["README.txt", readme], ...files];
}

/** Builds the zip, adding the cover from this tab when there is one. */
export async function buildSongPack(name: string, state: ForgeState): Promise<{ blob: Blob; filename: string; count: number }> {
  const slug = packSlug(name);
  const entries: ZipEntry[] = songPackFiles(name, state).map(([path, data]) => ({ name: `${slug}/${path}`, data }));
  const cover = getLastCover();
  if (cover) {
    try {
      const res = await fetch(cover);
      const blob = await res.blob();
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      entries.push({ name: `${slug}/cover/cover.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
    } catch {
      // The cover link expired; the pack is still useful without it.
    }
  }
  const bytes = buildZip(entries);
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }),
    filename: `${slug}-song-pack.zip`,
    count: entries.length,
  };
}
