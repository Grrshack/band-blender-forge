/**
 * Task orchestration for the forge. Everything that touches the network is
 * injected (`ask` = call the model and parse JSON, `lookup` = MusicBrainz), so the
 * whole flow can be tested with a scripted fake model.
 */

import { fixCliches, findCliches, type LyricBlock } from "@/lib/cliches";
import { clicheFixPrompt, prompt } from "@/lib/forge-prompts";
import type { ArtistLookup } from "@/lib/musicbrainz";
import { enforceNoArtistNames } from "@/lib/suno";

type Json = Record<string, unknown>;

export type PipelineDeps = {
  /** Sends a full prompt to the model and returns the parsed JSON object. */
  ask: (text: string) => Promise<Json>;
  /** Best-effort artist lookup. May throw; the pipeline then proceeds ungrounded. */
  lookup: (names: string[]) => Promise<ArtistLookup[]>;
};

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

const obj = (x: unknown): Json =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Json) : {};

async function safeLookup(deps: PipelineDeps, names: string[]): Promise<ArtistLookup[]> {
  if (!names.length) return [];
  try {
    return await deps.lookup(names);
  } catch {
    return [];
  }
}

const slim = (l: ArtistLookup) => ({
  name: l.name,
  status: l.status,
  ...(l.matchedName ? { matchedName: l.matchedName } : {}),
  tags: l.tags,
  ...(l.country ? { country: l.country } : {}),
  ...(l.type ? { type: l.type } : {}),
});

/** Rewrites cliché lines in `blocks` via one extra model call and reports what is left. */
async function cleanBlocks(
  blocks: LyricBlock[],
  deps: PipelineDeps,
  payload: Json,
): Promise<LyricBlock[]> {
  const style = obj(payload["style"]);
  const { blocks: fixed } = await fixCliches(blocks, async (hits) => {
    const out = await deps.ask(
      clicheFixPrompt(hits, {
        theme: typeof payload["theme"] === "string" ? (payload["theme"] as string) : "",
        styleTag: typeof style["styleTag"] === "string" ? (style["styleTag"] as string) : "",
      }),
    );
    const rewrites = Array.isArray(out["rewrites"]) ? out["rewrites"] : [];
    return rewrites
      .map((r) => obj(r))
      .filter((r) => typeof r["si"] === "number" && typeof r["li"] === "number")
      .map((r) => ({
        si: r["si"] as number,
        li: r["li"] as number,
        line: String(r["line"] ?? ""),
      }));
  });
  return fixed;
}

export async function runPipeline(task: string, payload: Json, deps: PipelineDeps): Promise<Json> {
  const base = prompt(task, payload);

  switch (task) {
    case "blend": {
      const names = strings(payload["artists"]).slice(0, 3);
      const grounding = await safeLookup(deps, names);
      const withRef = grounding.length ? { ...payload, reference: grounding.map(slim) } : payload;
      const text = grounding.length ? prompt("blend", withRef) : base;

      let result = await deps.ask(text);
      result = await enforceNoArtistNames(result, names, (feedback) =>
        deps.ask(`${text}\n\n${feedback}`),
      );

      if (grounding.length) result["grounding"] = grounding.map(slim);

      const missing = grounding.filter((g) => g.status === "not_found").map((g) => g.name);
      if (missing.length) {
        // The model graded its own familiarity; real data overrides it.
        result["confidence"] = {
          level: "low",
          note: `Couldn't find ${missing.map((m) => `"${m}"`).join(", ")} in MusicBrainz — the style for ${missing.length > 1 ? "them" : "it"} is inferred and may be off. Check the spelling.`,
        };
      }
      return result;
    }

    case "lyrics": {
      const result = await deps.ask(base);
      const sections = Array.isArray(result["sections"]) ? (result["sections"] as unknown[]) : [];
      const blocks = sections.map((s) => ({ lines: strings(obj(s)["lines"]) }));
      const fixed = await cleanBlocks(blocks, deps, payload);
      result["sections"] = sections.map((s, i) => ({ ...obj(s), lines: fixed[i]!.lines }));
      return result;
    }

    case "regenSection": {
      const result = await deps.ask(base);
      const original = (Array.isArray(payload["lines"]) ? (payload["lines"] as unknown[]) : []).map(
        (l) => obj(l),
      );
      const locked = original.map((l) => l["locked"] === true);
      const produced = strings(result["lines"]);

      // Locks are guaranteed in code, not left to the model.
      const lines = original.map((o, j) =>
        locked[j] ? String(o["text"] ?? "") : (produced[j] ?? String(o["text"] ?? "")),
      );
      const [fixed] = await cleanBlocks([{ lines, locked }], deps, payload);
      result["lines"] = fixed!.lines;
      return result;
    }

    case "regenLine": {
      let result = await deps.ask(base);
      const line = typeof result["line"] === "string" ? (result["line"] as string) : "";
      const found = findCliches(line);
      if (found.length) {
        try {
          const again = await deps.ask(
            `${base}\n\nYour line contained the worn-out phrase "${found[0]}". Write a different line with a concrete, specific image instead.`,
          );
          if (typeof again["line"] === "string" && !findCliches(again["line"] as string).length) {
            result = again;
          }
        } catch {
          /* keep the first attempt; the UI flags it */
        }
      }
      return result;
    }

    case "compare": {
      const result = await deps.ask(base);
      const artists = Array.isArray(result["artists"]) ? (result["artists"] as unknown[]) : [];
      const names = artists
        .map((a) => obj(a)["name"])
        .filter((n): n is string => typeof n === "string");
      const found = await safeLookup(deps, names.slice(0, 4));
      const byName = new Map(found.map((f) => [f.name, f]));
      result["artists"] = artists.map((a) => {
        const name = obj(a)["name"];
        const hit = typeof name === "string" ? byName.get(name.trim()) : undefined;
        return hit ? { ...obj(a), mb: slim(hit) } : a;
      });
      return result;
    }

    case "fixTake": {
      const names = strings(payload["artists"]).slice(0, 3);
      const result = await deps.ask(base);
      return enforceNoArtistNames(result, names, (feedback) => deps.ask(`${base}\n\n${feedback}`));
    }

    default:
      return deps.ask(base);
  }
}
