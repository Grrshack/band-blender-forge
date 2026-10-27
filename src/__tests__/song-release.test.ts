import { describe, expect, it } from "vitest";

import { emptyState, type ForgeState } from "@/components/forge/types";
import { artistNameHits, autoChecks, disclosureAnswers, suggestDisclosure } from "@/lib/release-check";
import { latestLyricCheck, nextStep, readinessPct, songSteps } from "@/lib/song-status";
import { attachCheck, newTake } from "@/lib/takes";

function song(): ForgeState {
  const s = emptyState();
  s.blend.artists = ["Portishead", "Nirvana", ""];
  s.blend.result = { styleTag: "trip-hop, grunge guitars", genre: "Trip-hop" };
  s.lyrics.title = "Night Shift";
  s.lyrics.sections = [{ tag: "[Verse 1]", lines: [{ text: "Headlights on the overpass", locked: false }] }];
  return s;
}

describe("song status", () => {
  it("starts with the sound and moves forward", () => {
    expect(nextStep(songSteps(emptyState()))!.id).toBe("sound");
    const s = song();
    expect(nextStep(songSteps(s))!.id).toBe("takes");
    s.takes = [newTake("trip-hop", "", 5, "great")];
    expect(nextStep(songSteps(s))!.id).toBe("lyriccheck");
  });

  it("counts a lyric check on the keeper and reaches 100%", () => {
    const s = song();
    const keeper = newTake("trip-hop", "", 5, "");
    s.takes = attachCheck([keeper], keeper.id, "lyric", { at: "2026-10-27T10:00:00Z", accuracyPct: 94, issues: [] });
    expect(latestLyricCheck(s.takes)!.accuracyPct).toBe(94);
    s.release = {
      masteredAt: "2026-10-27",
      cover: { at: "x", size: 3000, title: "Night Shift", artist: "Joe" },
      disclosure: { lyrics: "mostly", music: "all", vocals: "all", artwork: "none" },
    };
    const steps = songSteps(s);
    expect(nextStep(steps)).toBeNull();
    expect(readinessPct(steps)).toBe(100);
  });

  it("treats lyrics as optional for a structure-only instrumental", () => {
    const s = song();
    s.lyrics.sections = [];
    s.lyrics.tagsOnly = true;
    const steps = songSteps(s);
    expect(steps.find((x) => x.id === "lyrics")!.optional).toBe(true);
    expect(steps.find((x) => x.id === "lyriccheck")!.optional).toBe(true);
  });
});

describe("release check", () => {
  it("suggests AI answers from what the app knows", () => {
    expect(suggestDisclosure(song())).toEqual({ lyrics: "mostly", music: "all", vocals: "all" });
  });

  it("turns the four answers into distributor wording", () => {
    const a = disclosureAnswers({ lyrics: "none", music: "all", vocals: "all", artwork: "assisted" });
    expect(a[0]!.answer).toBe("No AI in the lyrics; AI contributed to the music; AI generated all of the audio");
    expect(a[1]!.answer).toMatch(/Artwork: AI involved/);
    expect(disclosureAnswers({ music: "all" })).toEqual([]);
  });

  it("catches real artist names in the lyrics", () => {
    const s = song();
    s.lyrics.sections[0]!.lines.push({ text: "Singing like Nirvana on the radio", locked: false });
    expect(artistNameHits(s)).toEqual(["Nirvana"]);
    expect(autoChecks(s).find((c) => c.id === "names")!.ok).toBe(false);
  });
});
