/**
 * Starter steps: five things that show a new person what Band Blender does, ticked off by the
 * tools themselves as they happen. Kept in this browser only (localStorage); nothing is sent
 * except the usual anonymous "starter_step" count.
 */
import { track } from "./stats";

export type StarterStepId = "quick" | "send" | "rate" | "check" | "artist";

export type StarterStep = { id: StarterStepId; title: string; body: string; href: string; cta: string };

export const STARTER_STEPS: StarterStep[] = [
  {
    id: "quick",
    title: "Make a quick song",
    body: "Describe it in a sentence. You get a style prompt and lyrics, checked and ready for Suno.",
    href: "/studio?tab=quick",
    cta: "Open Quick song",
  },
  {
    id: "send",
    title: "Send it to Suno",
    body: "Send it with the browser extension, or copy the boxes from the Suno Sheet.",
    href: "/studio?tab=suno",
    cta: "Open the Suno Sheet",
  },
  {
    id: "rate",
    title: "Rate a take",
    body: "After Suno makes it, say whether it was a keeper. Band Blender learns what works for you.",
    href: "/studio?tab=suno",
    cta: "Rate it on the Suno Sheet",
  },
  {
    id: "check",
    title: "Check a prompt",
    body: "Paste any Suno prompt into the free checker for a score and one-click fixes.",
    href: "/tools/suno-prompt-checker",
    cta: "Open the Prompt Checker",
  },
  {
    id: "artist",
    title: "Make your artist card",
    body: "Invent the act behind your song: a name, story, lineup and look, on a card you can share.",
    href: "/studio?tab=dossier",
    cta: "Open Bio & Pitch",
  },
];

export const STARTER_KEY = "bb.starter-steps";
/** Fired on window whenever a step is ticked or the list is hidden or shown. */
export const STARTER_EVENT = "bb:starter-steps";

export type StarterSaved = { done: Partial<Record<StarterStepId, string>>; hidden?: boolean };

const IDS = new Set<string>(STARTER_STEPS.map((s) => s.id));

export function readSteps(raw: string | null): StarterSaved {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (!v || typeof v !== "object") return { done: {} };
    const doneRaw = v["done"] && typeof v["done"] === "object" ? (v["done"] as Record<string, unknown>) : {};
    const done: StarterSaved["done"] = {};
    for (const [k, at] of Object.entries(doneRaw)) if (IDS.has(k) && typeof at === "string") done[k as StarterStepId] = at;
    return v["hidden"] === true ? { done, hidden: true } : { done };
  } catch {
    return { done: {} };
  }
}

export function loadSteps(): StarterSaved {
  if (typeof window === "undefined") return { done: {} };
  try {
    return readSteps(localStorage.getItem(STARTER_KEY));
  } catch {
    return { done: {} };
  }
}

function save(next: StarterSaved) {
  try {
    localStorage.setItem(STARTER_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the list just won't remember */
  }
  window.dispatchEvent(new CustomEvent(STARTER_EVENT));
}

export function progressOf(saved: StarterSaved): { done: number; total: number; pct: number; complete: boolean } {
  const total = STARTER_STEPS.length;
  const done = STARTER_STEPS.filter((s) => saved.done[s.id]).length;
  return { done, total, pct: Math.round((done / total) * 100), complete: done === total };
}

/** Ticks a step. Safe to call often: only the first time counts. */
export function markStep(id: StarterStepId, now = new Date()): void {
  if (typeof window === "undefined") return;
  const saved = loadSteps();
  if (saved.done[id]) return;
  const next: StarterSaved = { ...saved, done: { ...saved.done, [id]: now.toISOString() } };
  save(next);
  track("starter_step", id, { once: true });
  if (progressOf(next).complete) track("starter_step", "all", { once: true });
}

export function setStepsHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  const saved = loadSteps();
  save(hidden ? { ...saved, hidden: true } : { done: saved.done });
}

/** The next step to do, or null when all are done. */
export const nextStep = (saved: StarterSaved): StarterStep | null => STARTER_STEPS.find((s) => !saved.done[s.id]) ?? null;
