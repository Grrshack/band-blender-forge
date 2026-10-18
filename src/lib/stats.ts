/**
 * Anonymous tool-usage counts. Records only an event name, a short detail (such as which
 * tab) and a random id that lives in this browser tab and is gone when it closes. No user
 * id, no cookie, no lyrics, prompts or audio. Skipped entirely when the browser sends Do
 * Not Track or Global Privacy Control. Never throws and never slows the app down.
 */
import { supabase } from "@/integrations/supabase/client";

export type StatEvent =
  | "tab_open"
  | "start_choice"
  | "key_dialog_open"
  | "key_saved"
  | "key_test"
  | "ai_call"
  | "ai_error"
  | "master_loaded"
  | "master_export"
  | "recipe_shared"
  | "take_logged"
  | "guide_view";

const SESSION_KEY = "blf.stats.session";
const SEEN_KEY = "blf.stats.seen";

/** "Once" events already sent from this browser tab; kept across reloads of the tab. */
function alreadySent(key: string): boolean {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    if (seen.includes(key)) return true;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, key].slice(-200)));
    return false;
  } catch {
    return false;
  }
}

function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Logs one event. `once` skips repeats of the same event + detail in this tab, so opening
 * the same tool ten times counts once.
 */
export function track(event: StatEvent, detail = "", opts: { once?: boolean } = {}): void {
  if (typeof window === "undefined" || optedOut()) return;
  if (opts.once && alreadySent(`${event}:${detail}`)) return;
  const session_id = sessionId();
  if (!session_id) return;
  // The table isn't in the generated types until Lovable regenerates them, so it's untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  try {
    void Promise.resolve(
      db.from("app_events").insert({ session_id, event, detail: detail.slice(0, 40) }),
    ).catch(() => undefined);
  } catch {
    /* stats are optional */
  }
}
