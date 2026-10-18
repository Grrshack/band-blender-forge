import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert }) },
}));

async function freshTrack() {
  vi.resetModules();
  return (await import("@/lib/stats")).track;
}

describe("track", () => {
  let store: Record<string, string>;
  const stubBrowser = (doNotTrack: string) => {
    store = {};
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { doNotTrack });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
  };

  beforeEach(() => {
    insert.mockClear();
    vi.unstubAllGlobals();
    stubBrowser("0");
  });

  it("records only an event, a short detail and a per-tab id", async () => {
    const track = await freshTrack();
    track("tab_open", "master");
    expect(insert).toHaveBeenCalledTimes(1);
    const row = (insert.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(Object.keys(row).sort()).toEqual(["detail", "event", "session_id"]);
    expect(row["event"]).toBe("tab_open");
    expect(row["detail"]).toBe("master");
  });

  it("counts a `once` event one time per tab", async () => {
    const track = await freshTrack();
    track("tab_open", "fix", { once: true });
    track("tab_open", "fix", { once: true });
    track("tab_open", "lyrics", { once: true });
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when the browser asks not to be tracked", async () => {
    stubBrowser("1");
    const track = await freshTrack();
    track("ai_call", "blend");
    expect(insert).not.toHaveBeenCalled();
  });
});
