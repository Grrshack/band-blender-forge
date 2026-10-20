import { describe, expect, it } from "vitest";
import { isOverloaded, overloadMessage, withModelBackups } from "@/lib/provider-errors";

class Busy extends Error {}
class Fatal extends Error {}
const opts = {
  isBusy: (e: unknown) => e instanceof Busy,
  isFatal: (e: unknown) => e instanceof Fatal,
  wait: async () => {},
};

describe("isOverloaded", () => {
  it("recognises Google's 503 high-demand body and Anthropic's 529", () => {
    const google = '[{ "error": { "code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE" } } ]';
    expect(isOverloaded(503, google)).toBe(true);
    expect(isOverloaded(529, "")).toBe(true);
    expect(isOverloaded(400, google)).toBe(true);
    expect(isOverloaded(429, "quota exceeded")).toBe(false);
    expect(isOverloaded(400, "bad request")).toBe(false);
  });
  it("says it's not the user's key", () => {
    expect(overloadMessage("gemini")).toMatch(/not your key/);
  });
});

describe("withModelBackups", () => {
  it("returns the main model's answer when it works", async () => {
    const r = await withModelBackups(["a", "b"], async (m) => `ok:${m}`, opts);
    expect(r).toEqual({ value: "ok:a", model: "a" });
  });

  it("retries the main model once, then moves to backups", async () => {
    const calls: string[] = [];
    const r = await withModelBackups(
      ["a", "b", "c"],
      async (m) => {
        calls.push(m);
        if (m !== "c") throw new Busy();
        return "ok";
      },
      opts,
    );
    expect(calls).toEqual(["a", "a", "b", "c"]);
    expect(r.model).toBe("c");
  });

  it("succeeds on the retry without touching backups", async () => {
    let n = 0;
    const r = await withModelBackups(["a", "b"], async () => {
      if (n++ === 0) throw new Busy();
      return "ok";
    }, opts);
    expect(r.model).toBe("a");
    expect(n).toBe(2);
  });

  it("does not use backups for other errors on the main model", async () => {
    const calls: string[] = [];
    await expect(
      withModelBackups(["a", "b"], async (m) => {
        calls.push(m);
        throw new Error("rate limited");
      }, opts),
    ).rejects.toThrow("rate limited");
    expect(calls).toEqual(["a"]);
  });

  it("skips a backup that fails for another reason, but stops on a fatal error", async () => {
    const calls: string[] = [];
    await expect(
      withModelBackups(["a", "b", "c"], async (m) => {
        calls.push(m);
        if (m === "a") throw new Busy();
        throw new Fatal("key rejected");
      }, opts),
    ).rejects.toThrow("key rejected");
    expect(calls).toEqual(["a", "a", "b"]);
  });

  it("throws the friendly error when every model is busy", async () => {
    await expect(
      withModelBackups(["a", "b"], async () => { throw new Busy(); }, { ...opts, exhausted: () => new Error("all busy") }),
    ).rejects.toThrow("all busy");
  });
});

import { OverloadedError, withProFallback } from "@/lib/forge.functions";

describe("busy Pro", () => {
  it("answers on Flash without marking the key as having no Pro access", async () => {
    const r = await withProFallback(true, "craft", async (rt) => {
      if (rt === "craft") throw new OverloadedError("gemini");
      return "flash answer";
    });
    expect(r).toEqual({ value: "flash answer", downgraded: false });
  });
});
