import { describe, expect, it } from "vitest";
import { feedbackContext, feedbackCsv, validateFeedback, type FeedbackRow } from "@/lib/feedback";
import { summarizeUsage } from "@/lib/usage-summary";

describe("feedback context", () => {
  it("records page, tool and a short device description", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    const c = feedbackContext({ pathname: "/studio", search: "?tab=lyrics" }, 390, iphone);
    expect(c).toEqual({ page: "/studio", tool: "lyrics", device: "phone 390px, Safari on iOS" });
  });
  it("prefers the open tool over the address", () => {
    const chrome = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
    expect(feedbackContext({ pathname: "/studio", search: "" }, 1440, chrome, "master").tool).toBe("master");
    expect(feedbackContext({ pathname: "/", search: "" }, 1440, chrome).device).toBe("desktop 1440px, Chrome on Windows");
  });
});

describe("validation and export", () => {
  it("needs a few words", () => {
    expect(validateFeedback({ kind: "idea", message: "ok" })).toMatch(/few words/);
    expect(validateFeedback({ kind: "idea", message: "Add dark mode" })).toBeNull();
  });
  it("exports CSV with quotes and line breaks escaped", () => {
    const row = {
      id: 1, created_at: "2026-10-21T10:00:00Z", kind: "bug", message: 'It said "error",\nthen froze', suggestion: "",
      rating: 3, tester_name: "Sam", page: "/studio", tool: "blend", device: "phone", user_email: null, status: "new", admin_note: "",
    } as FeedbackRow;
    const csv = feedbackCsv([row]);
    expect(csv.split("\n")[0]).toBe("created_at,kind,status,rating,tester_name,user_email,tool,page,device,message,suggestion,admin_note");
    expect(csv).toContain('"It said ""error"",\nthen froze"');
  });
});

describe("usage summary", () => {
  it("counts unique visitors per tool and totals other events", () => {
    const e = (session_id: string, event: string, detail = "") => ({ created_at: "", session_id, event, detail });
    const s = summarizeUsage([
      e("a", "tab_open", "blend"), e("a", "tab_open", "blend"), e("b", "tab_open", "blend"), e("b", "tab_open", "analyze"),
      e("a", "start_choice", "landing_describe"), e("a", "ai_call"), e("b", "ai_error"),
    ]);
    expect(s.sessions).toBe(2);
    expect(s.tools[0]).toEqual({ label: "Band Blender", count: 2 });
    expect(s.tools).toContainEqual({ label: "Analyze a Song", count: 1 });
    expect(s.starts).toEqual([{ label: "landing_describe", count: 1 }]);
    expect(s.actions).toContainEqual({ label: "AI errors", count: 1 });
  });
});

import { nameUsageTotals } from "@/lib/usage-summary";

describe("database usage totals", () => {
  it("names tools and actions for people", () => {
    const n = nameUsageTotals({
      sessions: 300,
      tools: [{ key: "blend", count: 50 }, { key: "analyze", count: 7 }],
      starts: [{ key: "landing_describe", count: 9 }],
      actions: [{ key: "ai_error", count: 3 }],
    });
    expect(n.sessions).toBe(300);
    expect(n.tools).toEqual([{ label: "Band Blender", count: 50 }, { label: "Analyze a Song", count: 7 }]);
    expect(n.actions).toEqual([{ label: "AI errors", count: 3 }]);
  });
});
