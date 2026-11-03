import { describe, expect, it } from "vitest";
import {
  SEED_BUCKETS,
  swapDraftFormat,
  albumZipFiles,
  currentDrop,
  draftFromBlend,
  genreTags,
  lyricsPayload,
  newDraft,
  nextDrop,
  pairKey,
  pickSeeds,
  plannerAlbum,
  projectFromPlan,
  sectionsFrom,
  trackSongName,
  trackState,
} from "./lab";
import { BRIEF_PART_MAX, cleanAlbumPlan, runPipeline } from "./forge-pipeline";
import { briefMatches, joinBrief } from "./prompt-craft";
import { fakeAsk } from "./fake-ai";
import { DAILY_TEXT, limitKind, paced } from "./rate-pace";
import { nextModelWhenOutOfQuota, rateLimitMessage } from "./provider-errors";

/** A repeatable stand-in for Math.random. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const laneOf = (artist: string) => SEED_BUCKETS.find((b) => b.artists.includes(artist))!.lane;

describe("Lab Picks seeds", () => {
  it("pairs artists from different lanes, never reusing an artist in one batch", () => {
    const seeds = pickSeeds(6, new Set(), seeded());
    expect(seeds).toHaveLength(6);
    for (const [a, b] of seeds) expect(laneOf(a!)).not.toBe(laneOf(b!));
    const all = seeds.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("skips pairs already dropped, whatever the order", () => {
    const first = pickSeeds(1, new Set(), seeded(3))[0]!;
    const avoid = new Set([pairKey([...first].reverse())]);
    const again = pickSeeds(5, avoid, seeded(3));
    expect(again.map(pairKey)).not.toContain(pairKey(first));
  });
});

describe("Lab Picks drafts and drops", () => {
  it("fills a draft from a blend, and fails clearly without a style", () => {
    const d = newDraft(["Portishead", "Deftones"]);
    expect(d.title).toBe("Portishead × Deftones");
    const ok = draftFromBlend(d, { styleTag: "trip-hop, heavy guitars", excludeStyles: "autotune", genre: "Trip-hop / Alt-metal", vocalPrompt: { voice: "alto", delivery: "" } });
    expect(ok.status).toBe("ready");
    expect(ok.vocalPrompt).toEqual({ voice: "alto" });
    expect(genreTags(ok.genre)).toEqual(["trip-hop", "alt-metal"]);
    expect(draftFromBlend(d, {}).status).toBe("failed");
  });

  it("publishes the Studio Brief by default, with its six parts, and keeps the tag list as the other version", async () => {
    const payload = { artists: ["Portishead", "Deftones"], promptFormat: "brief" };
    const blend = await runPipeline("blend", payload, { ask: fakeAsk("blend", payload), lookup: async () => [] });
    const d = draftFromBlend(newDraft(["Portishead", "Deftones"]), blend as never);
    expect(d.styleFormat).toBe("brief");
    expect(briefMatches(d.briefParts, d.styleTag)).toBe(true);
    expect(Object.keys(d.briefParts!)).toEqual(["sound", "pulse", "players", "voice", "arc", "finish"]);
    expect(d.styleAlt).toMatch(/^dark synthpop,/);
    const tags = swapDraftFormat(d);
    expect(tags.styleFormat).toBe("tags");
    expect(tags.styleTag).toBe(d.styleAlt);
    expect(swapDraftFormat(tags).styleTag).toBe(d.styleTag);
  });

  it("finds the next Monday or Friday at 9:00, always in the future", () => {
    const wedNoon = new Date(2026, 10, 4, 12, 0); // Wed Nov 4 2026
    const mon = nextDrop(1, 9, wedNoon);
    expect([mon.getDay(), mon.getHours(), mon.getDate()]).toEqual([1, 9, 9]);
    const fri = nextDrop(5, 9, wedNoon);
    expect([fri.getDay(), fri.getDate()]).toEqual([5, 6]);
    const monLate = new Date(2026, 10, 9, 10, 0); // Monday after 9:00
    expect(nextDrop(1, 9, monLate).getDate()).toBe(16);
    const monEarly = new Date(2026, 10, 9, 8, 0); // Monday before 9:00
    expect(nextDrop(1, 9, monEarly).getDate()).toBe(9);
  });

  it("shows only the newest live drop", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const picks = [
      { id: "a", drop_at: "2026-11-09T09:00:00Z" },
      { id: "b", drop_at: "2026-11-09T09:00:00Z" },
      { id: "c", drop_at: "2026-11-06T09:00:00Z" },
      { id: "d", drop_at: "2026-11-13T09:00:00Z" }, // future
    ];
    expect(currentDrop(picks, now).map((p) => p.id)).toEqual(["a", "b"]);
    expect(currentDrop([{ id: "x", drop_at: "2026-12-01T00:00:00Z" }], now)).toEqual([]);
  });
});

describe("Album Producer", () => {
  it("cleans a plan: track count, limits, no artist names, sane tempos", () => {
    const raw = {
      title: "Neon Portishead Nights",
      concept: "Rainy city",
      sharedSound: "trip-hop like Portishead, dark",
      excludeStyles: "autotune",
      tracks: Array.from({ length: 7 }, (_, i) => ({
        title: `Song ${i + 1}`,
        role: "Opener",
        styleTag: i === 3 ? "" : `trip-hop, ${"x".repeat(i === 0 ? 1200 : 10)}`,
        twist: "slower",
        theme: "leaving",
        hook: "go",
        bpm: i === 1 ? 999 : 90,
      })),
    };
    const out = cleanAlbumPlan(raw, ["Portishead"], 5) as { title: string; sharedSound: string; tracks: Array<{ styleTag: string; n: number; bpm?: number }> };
    expect(out.tracks).toHaveLength(5);
    expect(out.tracks.map((t) => t.n)).toEqual([1, 2, 3, 4, 5]);
    expect(out.tracks[0]!.styleTag.length).toBeLessThanOrEqual(1000);
    expect(out.tracks[1]!.bpm).toBeUndefined();
    expect(out.title).not.toMatch(/portishead/i);
    expect(out.sharedSound).not.toMatch(/portishead/i);
  });

  it("builds every track's Studio Brief from the shared parts plus its own pulse, players and arc", () => {
    const long = (w: string) => `${w} `.repeat(80).trim() + ".";
    const raw = {
      title: "Record",
      sharedBrief: { sound: "Dark trip-hop, smoky and slow.", pulse: "80 BPM, heavy.", players: long("bass"), voice: "A breathy alto, close and upfront.", arc: "Verses hold back.", finish: "Dusty and wide." },
      tracks: [
        { title: "A", styleTag: "trip-hop, 84 bpm", pulse: "84 BPM, a slow head-nod swing.", players: "Upright bass and brushed drums.", arc: "The chorus adds strings." },
        { title: "B", styleTag: "trip-hop, 96 bpm", pulse: "96 BPM, pushing forward." },
      ],
    };
    const out = cleanAlbumPlan(raw, [], 5) as { sharedBrief: Record<string, string>; tracks: Array<{ briefParts: Record<string, string>; styleBrief: string }> };
    expect(out.sharedBrief["players"]!.length).toBeLessThanOrEqual(BRIEF_PART_MAX.players);
    const [a, b] = out.tracks;
    expect(a!.briefParts["pulse"]).toBe("84 BPM, a slow head-nod swing.");
    expect(a!.briefParts["players"]).toBe("Upright bass and brushed drums.");
    expect(a!.briefParts["voice"]).toBe("A breathy alto, close and upfront.");
    expect(b!.briefParts["players"]).toBe(out.sharedBrief["players"]); // unchanged parts come from the shared brief
    for (const t of out.tracks) {
      expect(t.styleBrief).toBe(joinBrief(t.briefParts));
      expect(t.styleBrief.length).toBeLessThanOrEqual(1000);
    }
    // No shared brief from the AI: tracks still work with their tag lists.
    const tagsOnly = cleanAlbumPlan({ tracks: [{ styleTag: "lofi, 80 bpm" }] }, [], 3) as { tracks: Array<Record<string, unknown>> };
    expect(tagsOnly.tracks[0]!["briefParts"]).toBeUndefined();
    expect(projectFromPlan(tagsOnly, { concept: "", artists: [], artistName: "" }).format).toBe("tags");
  });

  it("plans with the canned AI answer through the real pipeline", async () => {
    const payload = { concept: "rainy city", artists: [], trackCount: 4 };
    const plan = await runPipeline("albumPlan", payload, { ask: fakeAsk("albumPlan", payload), lookup: async () => [] });
    const p = projectFromPlan(plan, { concept: "rainy city", artists: ["Massive Attack"], artistName: "Night Bus" });
    expect(p.tracks).toHaveLength(4);
    expect(p.tracks.every((t) => t.status === "planned" && t.styleTag)).toBe(true);
    expect(p.title).toBe("Glass City");
    expect(p.format).toBe("brief");
    for (const t of p.tracks) {
      expect(briefMatches(t.briefParts, t.styleTag)).toBe(true);
      expect(t.styleAlt).toMatch(/^dark synthpop,/);
    }
    expect(p.tracks[0]!.briefParts!.pulse).toMatch(/^88 BPM/);
    expect(p.tracks[1]!.briefParts!.players).toMatch(/piano/);
  });

  it("writes lyrics through the normal lyrics task and saves tracks as normal songs", async () => {
    const planPayload = { trackCount: 4 };
    const plan = await runPipeline("albumPlan", planPayload, { ask: fakeAsk("albumPlan", planPayload), lookup: async () => [] });
    const p = projectFromPlan(plan, { concept: "x", artists: ["Massive Attack"], artistName: "Night Bus" });
    const t = p.tracks[1]!;
    const lp = lyricsPayload(p, t);
    expect(String(lp["notes"])).toContain("Track 2 of 4");
    expect((lp["style"] as { styleTag: string }).styleTag).toBe(t.styleTag);

    const lyrics = await runPipeline("lyrics", lp, { ask: fakeAsk("lyrics", lp), lookup: async () => [] });
    const sections = sectionsFrom(lyrics as never);
    expect(sections.length).toBeGreaterThan(2);
    const done = { ...t, sections, lyricTitle: "Neon Rain", status: "done" as const, songId: "song-2" };
    const state = trackState(p, done);
    expect(state.blend.result?.styleTag).toBe(t.styleTag);
    expect(state.blend.result?.styleFormat).toBe("brief");
    expect(briefMatches(state.blend.result?.briefParts, state.blend.result?.styleTag)).toBe(true);
    expect(state.blend.result?.styleAlt).toBe(t.styleAlt);
    expect((lp["style"] as { vocals: string }).vocals).toMatch(/alto/);
    expect(state.lyrics.title).toBe("Neon Rain");
    expect(state.release?.artist).toBe("Night Bus");
    expect(trackSongName(p, done)).toBe("Glass City — 02 Neon Rain");

    const withDone = { ...p, tracks: p.tracks.map((x) => (x.n === 2 ? done : x)) };
    const album = plannerAlbum(withDone);
    expect(album.tracks[1]).toMatchObject({ songId: "song-2", title: "Neon Rain", single: true });

    const files = albumZipFiles(withDone).map(([path]) => path);
    expect(files).toContain("glass-city/TRACKLIST.txt");
    expect(files).toContain("glass-city/02-neon-rain/suno/lyrics.txt");
    expect(files).toContain("glass-city/02-neon-rain/suno/style-tags.txt"); // the other format comes along
    expect(files.some((f) => f.startsWith("glass-city/01-"))).toBe(false); // not written yet
  });
});


describe("pacing free-key batches", () => {
  it("tells a daily limit from a per-minute one", () => {
    expect(limitKind(rateLimitMessage("gemini", { kind: "day", retryMs: null }))).toBe("day");
    expect(limitKind(rateLimitMessage("gemini", { kind: "minute", retryMs: 30_000 }))).toBe("minute");
    expect(limitKind(rateLimitMessage("gemini", { kind: "unknown", retryMs: null }))).toBe("minute");
    expect(limitKind("The AI took too long to answer")).toBeNull();
    expect(limitKind(DAILY_TEXT)).toBe("day");
  });

  it("spaces calls out and waits out one per-minute limit", async () => {
    let clock = 1_000_000;
    const waits: number[] = [];
    const state = { lastAt: 0 };
    const opts = { state, gapMs: 13_000, now: () => clock, wait: async (ms: number) => { waits.push(ms); clock += ms; } };
    await paced(async () => "a", opts);
    clock += 2_000;
    await paced(async () => "b", opts);
    expect(waits).toEqual([11_000]);
    let tries = 0;
    const out = await paced(async () => {
      tries++;
      if (tries === 1) throw new Error(rateLimitMessage("gemini", { kind: "minute", retryMs: null }));
      return "ok";
    }, opts);
    expect(out).toBe("ok");
    expect(waits.at(-1)).toBe(60_000);
    await expect(paced(async () => { throw new Error(rateLimitMessage("gemini", { kind: "day", retryMs: null })); }, opts)).rejects.toThrow(/today's/);
  });

  it("moves to the next model when one model's allowance is used up", async () => {
    const quota = new Error("out");
    const tried: number[] = [];
    const v = await nextModelWhenOutOfQuota(3, async (i) => { tried.push(i); if (i < 2) throw quota; return `model ${i}`; }, (e) => e === quota);
    expect(v).toBe("model 2");
    expect(tried).toEqual([0, 1, 2]);
    await expect(nextModelWhenOutOfQuota(3, async () => { throw new Error("rejected"); }, (e) => e === quota)).rejects.toThrow("rejected");
    await expect(nextModelWhenOutOfQuota(2, async () => { throw quota; }, (e) => e === quota)).rejects.toBe(quota);
  });
});
