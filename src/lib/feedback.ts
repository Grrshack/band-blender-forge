/**
 * Tester feedback. Saved straight to the `feedback` table from the browser; the database
 * adds who sent it from their sign-in and only admins can read it (see the Oct 21 migration).
 */

export type FeedbackKind = "bug" | "confusing" | "idea" | "praise";

export const FEEDBACK_KINDS: Array<{ value: FeedbackKind; label: string; prompt: string }> = [
  { value: "bug", label: "Something broke", prompt: "What happened? What did you click just before?" },
  { value: "confusing", label: "Confusing", prompt: "What was unclear, or where did you get stuck?" },
  { value: "idea", label: "Idea", prompt: "What would you add or change?" },
  { value: "praise", label: "I like this", prompt: "What worked well for you?" },
];

export const FEEDBACK_STATUSES = [
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "wont_do", label: "Won't do" },
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["value"];

export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  suggestion?: string;
  rating?: number | null;
  testerName?: string;
};

export type FeedbackRow = {
  id: number;
  created_at: string;
  kind: FeedbackKind;
  message: string;
  suggestion: string;
  rating: number | null;
  tester_name: string;
  page: string;
  tool: string;
  device: string;
  user_email: string | null;
  status: FeedbackStatus;
  admin_note: string;
};

/** Event that opens the feedback form, optionally pre-filled (e.g. from an error message). */
export const FEEDBACK_EVENT = "bb:feedback";
export type FeedbackPrefill = { kind?: FeedbackKind; message?: string };

export function openFeedback(prefill: FeedbackPrefill = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FeedbackPrefill>(FEEDBACK_EVENT, { detail: prefill }));
}

/** Where the person was and on what, gathered automatically. No lyrics, keys or audio. */
export function feedbackContext(loc: { pathname: string; search: string }, width: number, ua: string, tool = "") {
  const browser =
    /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const kind = width < 768 ? "phone" : width < 1100 ? "tablet" : "desktop";
  const tab = new URLSearchParams(loc.search).get("tab") ?? "";
  return {
    page: `${loc.pathname}`.slice(0, 200),
    tool: (tool || tab).slice(0, 40),
    device: `${kind} ${width}px, ${browser} on ${os}`.slice(0, 200),
  };
}

export function validateFeedback(input: FeedbackInput): string | null {
  if (input.message.trim().length < 3) return "Write a few words about what happened or what you think.";
  if (input.message.length > 2000 || (input.suggestion ?? "").length > 2000) return "That's a bit long; keep each box under 2,000 characters.";
  return null;
}

export async function sendFeedback(input: FeedbackInput): Promise<void> {
  const error = validateFeedback(input);
  if (error) throw new Error(error);
  const ctx = feedbackContext(
    window.location,
    window.innerWidth,
    navigator.userAgent,
    document.body.dataset["tab"] ?? "",
  );
  // Loaded here, not at the top, so pages don't download the database library until needed.
  const { supabase } = await import("@/integrations/supabase/client");
  // The table isn't in the generated types until Lovable regenerates them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error: dbError } = await db.from("feedback").insert({
    kind: input.kind,
    message: input.message.trim(),
    suggestion: (input.suggestion ?? "").trim(),
    rating: input.rating ?? null,
    tester_name: (input.testerName ?? "").trim().slice(0, 80),
    ...ctx,
  });
  if (dbError) {
    throw new Error(
      /Too much feedback/i.test(dbError.message ?? "")
        ? "Lots of feedback is coming in right now. Try again in a minute."
        : "Couldn't send it right now. Try again in a minute.",
    );
  }
}

/** Spreadsheet-friendly export of the log. */
export function feedbackCsv(rows: FeedbackRow[]): string {
  const cols: Array<keyof FeedbackRow> = [
    "created_at", "kind", "status", "rating", "tester_name", "user_email", "tool", "page", "device", "message", "suggestion", "admin_note",
  ];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
