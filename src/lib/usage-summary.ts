/** Turns raw anonymous usage events into the short lists on the feedback admin page. Pure. */
export type UsageEvent = { created_at: string; session_id: string; event: string; detail: string };
export type Count = { label: string; count: number };

const TOOL_NAMES: Record<string, string> = {
  assistant: "Start here",
  blend: "Band Blender",
  analyze: "Analyze a Song",
  lyrics: "Lyric Forge",
  genres: "Genre Guides",
  compare: "Comparables",
  suno: "Export Sheet",
  fix: "Fix a Track",
  feedback: "Honest Feedback",
  songcompare: "Compare Songs",
  lyriccheck: "Lyric Check",
  song: "This Song",
  releasecheck: "Release Check",
  cover: "Cover Maker",
  album: "Album Planner",
  promo: "Promo Clips",
  master: "Mastering",
  dossier: "Release Kit",
  library: "Prompt Library",
  usage: "Usage",
};

const ACTION_NAMES: Record<string, string> = {
  key_dialog_open: "Opened AI key setup",
  key_saved: "Saved an AI key",
  key_test: "Tested a key",
  ai_call: "AI requests",
  ai_error: "AI errors",
  master_loaded: "Loaded audio to master",
  master_export: "Exported a master",
  recipe_shared: "Shared a recipe",
  take_logged: "Logged a take",
  guide_view: "Read a guide",
};

const top = (m: Map<string, number>, n = 12): Count[] =>
  [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, n);

export function summarizeUsage(events: UsageEvent[]) {
  const sessions = new Set(events.map((e) => e.session_id));
  // Tools: unique visitors per tool, so one person opening a tab ten times counts once.
  const toolVisitors = new Map<string, Set<string>>();
  const starts = new Map<string, number>();
  const actions = new Map<string, number>();
  for (const e of events) {
    if (e.event === "tab_open") {
      const name = TOOL_NAMES[e.detail] ?? e.detail;
      if (!toolVisitors.has(name)) toolVisitors.set(name, new Set());
      toolVisitors.get(name)!.add(e.session_id);
    } else if (e.event === "start_choice") {
      starts.set(e.detail || "(none)", (starts.get(e.detail || "(none)") ?? 0) + 1);
    } else {
      const name = ACTION_NAMES[e.event] ?? e.event;
      actions.set(name, (actions.get(name) ?? 0) + 1);
    }
  }
  return {
    sessions: sessions.size,
    tools: top(new Map([...toolVisitors].map(([k, v]) => [k, v.size]))),
    starts: top(starts),
    actions: top(actions),
  };
}

/** Totals as counted by the database (admin_usage_summary), named for people. */
export type UsageTotals = {
  sessions: number;
  tools: Array<{ key: string; count: number }>;
  starts: Array<{ key: string; count: number }>;
  actions: Array<{ key: string; count: number }>;
};

export function nameUsageTotals(t: UsageTotals) {
  const named = (rows: Array<{ key: string; count: number }>, names: Record<string, string>): Count[] =>
    rows.map((r) => ({ label: names[r.key] ?? (r.key || "(none)"), count: Number(r.count) })).slice(0, 12);
  return {
    sessions: Number(t.sessions) || 0,
    tools: named(t.tools ?? [], TOOL_NAMES),
    starts: named(t.starts ?? [], {}),
    actions: named(t.actions ?? [], ACTION_NAMES),
  };
}
