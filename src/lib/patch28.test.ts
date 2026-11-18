import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stats", () => ({ track: vi.fn() }));

import { emptyState, hasContent, mergeState } from "@/components/forge/types";
import {
  DEFAULT_PALETTE,
  cardColors,
  cleanIdentity,
  dropFakeClaims,
  findIdentityLeaks,
  identityMarkdown,
  identityText,
  readIdentity,
} from "./artist-identity";
import { fakeAsk } from "./fake-ai";
import { runPipeline } from "./forge-pipeline";
import { prompt } from "./forge-prompts";
import { songPackFiles } from "./song-pack";
import { STARTER_KEY, STARTER_STEPS, loadSteps, markStep, nextStep, progressOf, readSteps, setStepsHidden } from "./starter-steps";
import { track } from "./stats";

const good = {
  name: "Glass Harbor",
  tagline: "Synth ballads for the last train home.",
  genre: "Dark synthpop",
  story: "Two night-shift workers write songs on a borrowed synth between trains.",
  members: [
    { name: "Mara Venn", role: "vocals" },
    { name: "Theo Lark", role: "synths" },
  ],
  look: "Rain-soaked coats under sodium streetlight.",
  palette: ["#14122B", "#3a6ea5", "#f2b8c6"],
};

describe("artist identity: cleaning", () => {
  it("keeps a good answer, lower-cases colours and trims", () => {
    const id = cleanIdentity({ ...good, name: "  Glass Harbor " }, []);
    expect(id.name).toBe("Glass Harbor");
    expect(id.members).toHaveLength(2);
    expect(id.palette).toEqual(["#14122b", "#3a6ea5", "#f2b8c6"]);
  });

  it("never names the act after a real artist", () => {
    expect(cleanIdentity({ ...good, name: "Portishead" }, ["Portishead"]).name).toBe("Untitled Project");
    expect(cleanIdentity({ ...good, name: "ghost" }, [], "auto", ["Ghost"]).name).toBe("Untitled Project");
    expect(cleanIdentity({ ...good, name: "" }, []).name).toBe("Untitled Project");
  });

  it("scrubs the blend's artists from the text but leaves everyday words alone", () => {
    const id = cleanIdentity({ ...good, story: "They love Portishead and ghost stories." }, ["Portishead"], "auto", ["Ghost"]);
    expect(id.story).not.toMatch(/Portishead/);
    expect(id.story).toMatch(/ghost stories/);
  });

  it("drops invented achievements", () => {
    expect(dropFakeClaims("They met in Leeds. Their debut went platinum in a week. They still rehearse in a garage.")).toBe(
      "They met in Leeds. They still rehearse in a garage.",
    );
    expect(cleanIdentity({ ...good, tagline: "The Grammy-winning duo" }, []).tagline).toBe("");
  });

  it("caps the lineup to what was asked and to five", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Member ${i}`, role: "x" }));
    expect(cleanIdentity({ ...good, members: many }, []).members).toHaveLength(5);
    expect(cleanIdentity({ ...good, members: many }, [], "solo").members).toHaveLength(1);
    expect(cleanIdentity({ ...good, members: many }, [], "duo").members).toHaveLength(2);
  });

  it("falls back to a default palette when colours are missing or bad", () => {
    expect(cleanIdentity({ ...good, palette: ["red", "#12"] }, []).palette).toEqual(DEFAULT_PALETTE);
  });

  it("clips long fields at a word or sentence", () => {
    const id = cleanIdentity({ ...good, story: "Word ".repeat(200) }, []);
    expect(id.story.length).toBeLessThanOrEqual(480);
    expect(id.story.endsWith("Word")).toBe(true);
  });

  it("finds leaks in members and text, and in the name only as the whole name", () => {
    expect(findIdentityLeaks({ ...good, story: "Like Massive Attack at dawn." }, ["Massive Attack"])).toEqual(["Massive Attack"]);
    expect(findIdentityLeaks({ ...good, story: "A ghost of a melody." }, [], ["Ghost"])).toEqual([]);
    expect(findIdentityLeaks({ ...good, name: "Ghost" }, [], ["Ghost"])).toEqual(["Ghost"]);
  });

  it("reads saves back safely", () => {
    expect(readIdentity(null)).toBeNull();
    expect(readIdentity({ name: "" })).toBeNull();
    expect(readIdentity({ ...good, at: "2026-11-18T00:00:00Z" })?.at).toBe("2026-11-18T00:00:00Z");
  });

  it("picks readable text colours for the card", () => {
    expect(cardColors(["#14122b", "#3a6ea5", "#f2b8c6"]).text).toBe("#ffffff");
    expect(cardColors(["#fff4e0", "#ffe0f0", "#202020"]).text).toBe("#111111");
    expect(cardColors(["#f2b8c6", "#14122b"]).from).toBe("#14122b");
  });

  it("writes text and markdown versions", () => {
    const id = cleanIdentity(good, []);
    expect(identityText(id)).toMatch(/^Glass Harbor\n/);
    expect(identityText(id)).toMatch(/- Mara Venn: vocals/);
    expect(identityMarkdown(id)).toMatch(/^# Glass Harbor/);
    expect(identityMarkdown(id)).toMatch(/don't claim real achievements/i);
  });
});

describe("artist identity: the AI task", () => {
  it("asks for the lineup and forbids real names and achievements", () => {
    const p = prompt("identity", { lineup: "duo", artists: ["Portishead"] });
    expect(p).toMatch(/exactly two members/);
    expect(p).toMatch(/no names from "artists"/);
    expect(p).toMatch(/Don't invent achievements/);
    expect(p).toMatch(/"palette"/);
  });

  it("re-asks once when the act is named after a blend artist, then cleans", async () => {
    const answers = [{ ...good, name: "Portishead" }, { ...good }];
    const ask = vi.fn(async (_text: string) => answers.shift() as Record<string, unknown>);
    const r = await runPipeline("identity", { artists: ["Portishead"], lineup: "duo" }, { ask, lookup: async () => [] });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(String(ask.mock.calls[1]![0])).toMatch(/used real names: "Portishead"/);
    expect(r["name"]).toBe("Glass Harbor");
  });

  it("cleans a second bad answer instead of failing", async () => {
    const ask = vi.fn(async () => ({ ...good, name: "Portishead" }));
    const r = await runPipeline("identity", { artists: ["Portishead"] }, { ask, lookup: async () => [] });
    expect(r["name"]).toBe("Untitled Project");
  });

  it("has a test answer that passes the cleaner unchanged", async () => {
    const raw = await fakeAsk("identity", {})("");
    expect(cleanIdentity(raw, []).name).toBe(raw["name"]);
  });

  it("tells Bio & Pitch to write about the act", () => {
    expect(prompt("dossier", { act: { name: "Glass Harbor" } })).toMatch(/If the input has "act"/);
  });
});

describe("artist identity: saved with the song", () => {
  it("survives a save and reload, and counts as content", () => {
    const s = { ...emptyState(), identity: { ...cleanIdentity(good, []), at: "2026-11-18T00:00:00Z" } };
    const back = mergeState(JSON.parse(JSON.stringify(s)));
    expect(back.identity?.name).toBe("Glass Harbor");
    expect(hasContent({ ...emptyState(), identity: back.identity! })).toBe(true);
    expect(mergeState({ ...emptyState(), identity: { name: "" } }).identity).toBeUndefined();
  });

  it("goes into the song pack", () => {
    const s = { ...emptyState(), identity: cleanIdentity(good, []) };
    const files = new Map(songPackFiles("Neon", s));
    expect(files.get("release/artist-identity.md")).toMatch(/^# Glass Harbor/);
    expect(files.get("README.txt") ?? [...files.values()].join("\n")).toMatch(/artist-identity\.md/);
  });
});

describe("starter steps", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  beforeEach(() => {
    vi.stubGlobal("localStorage", memory());
    vi.stubGlobal("window", new EventTarget());
    vi.mocked(track).mockClear();
  });

  it("has five steps with unique ids and links", () => {
    expect(STARTER_STEPS.map((s) => s.id)).toEqual(["quick", "send", "rate", "check", "artist"]);
    for (const s of STARTER_STEPS) expect(s.href).toMatch(/^\/(studio\?tab=[a-z]+|tools\/)/);
  });

  it("reads bad or old saves as empty and ignores unknown steps", () => {
    expect(readSteps(null)).toEqual({ done: {} });
    expect(readSteps("{oops")).toEqual({ done: {} });
    expect(readSteps(JSON.stringify({ done: { quick: "t", nope: "t", send: 3 } }))).toEqual({ done: { quick: "t" } });
  });

  it("ticks each step once, tells the page, and counts the finish", () => {
    const heard = vi.fn();
    window.addEventListener("bb:starter-steps", heard);
    markStep("quick");
    markStep("quick");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(progressOf(loadSteps())).toMatchObject({ done: 1, total: 5, pct: 20, complete: false });
    expect(nextStep(loadSteps())?.id).toBe("send");
    for (const s of STARTER_STEPS) markStep(s.id);
    expect(progressOf(loadSteps()).complete).toBe(true);
    expect(nextStep(loadSteps())).toBeNull();
    expect(vi.mocked(track).mock.calls.filter((c) => c[0] === "starter_step").map((c) => c[1])).toEqual([
      "quick",
      "send",
      "rate",
      "check",
      "artist",
      "all",
    ]);
  });

  it("hides and shows without losing progress", () => {
    markStep("check");
    setStepsHidden(true);
    expect(loadSteps()).toMatchObject({ hidden: true, done: { check: expect.any(String) } });
    setStepsHidden(false);
    expect(loadSteps().hidden).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(STARTER_KEY)!).done.check).toBeTruthy();
  });
});
