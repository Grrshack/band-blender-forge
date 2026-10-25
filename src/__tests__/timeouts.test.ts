import { describe, expect, it } from "vitest";

import {
  AiTimeoutError,
  fetchWithTimeout,
  isTimeoutLike,
  makeDeadline,
  withModelBackups,
} from "@/lib/provider-errors";

describe("request time budget", () => {
  it("counts down and caps each call to what's left", () => {
    let t = 0;
    const d = makeDeadline(85_000, () => t);
    expect(d.capFor(40_000)).toBe(40_000);
    t = 60_000;
    expect(d.remaining()).toBe(25_000);
    expect(d.capFor(40_000)).toBe(25_000);
    expect(() => d.check()).not.toThrow();
    t = 82_000;
    expect(() => d.check()).toThrow(AiTimeoutError);
  });

  it("turns a slow call into AiTimeoutError", async () => {
    const slow = fetchWithTimeout(20, (signal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    await expect(slow).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it("passes a quick answer straight through", async () => {
    await expect(fetchWithTimeout(1000, async () => "ok")).resolves.toBe("ok");
  });

  it("moves on to a backup model when the first one is too slow", async () => {
    const tried: string[] = [];
    const r = await withModelBackups(
      ["flash", "backup"],
      async (m) => {
        tried.push(m);
        if (m === "flash") throw new AiTimeoutError();
        return "done";
      },
      { isBusy: (e) => e instanceof AiTimeoutError, isFatal: () => false, wait: async () => {} },
    );
    expect(r).toEqual({ value: "done", model: "backup" });
    expect(tried).toEqual(["flash", "flash", "backup"]);
  });
});

describe("isTimeoutLike", () => {
  it("recognises the host's 524 and dropped connections", () => {
    expect(isTimeoutLike("error code: 524")).toBe(true);
    expect(isTimeoutLike("Failed to fetch")).toBe(true);
    expect(isTimeoutLike("Load failed")).toBe(true);
    expect(isTimeoutLike("The AI took too long to answer")).toBe(true);
  });
  it("leaves real errors alone", () => {
    expect(isTimeoutLike("Your Google Gemini key was rejected. Check you copied the whole key.")).toBe(false);
    expect(isTimeoutLike("You've used today's free Gemini requests for this model.")).toBe(false);
    expect(isTimeoutLike("Wait about 52 seconds and try again")).toBe(false);
  });
});
