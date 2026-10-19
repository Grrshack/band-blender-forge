import { describe, expect, it, vi } from "vitest";

import { RateLimitError, withProFallback } from "@/lib/forge.functions";

const noFreeTier = new RateLimitError({ kind: "unavailable", retryMs: null }, "gemini");
const perMinute = new RateLimitError({ kind: "minute", retryMs: 5000 }, "gemini");

describe("withProFallback", () => {
  it("runs a craft call on Flash when the Google key has no Pro access", async () => {
    const run = vi.fn(async (r: string) => {
      if (r === "craft") throw noFreeTier;
      return "flash result";
    });
    await expect(withProFallback(true, "craft", run)).resolves.toEqual({ value: "flash result", downgraded: true });
    expect(run.mock.calls.map((c) => c[0])).toEqual(["craft", "fast"]);
  });

  it("falls back on any Pro failure, including a bare 429 or an unknown model", async () => {
    for (const err of [perMinute, new Error("models/gemini-3.1-pro-preview is not found")]) {
      const run = vi.fn(async (r: string) => {
        if (r === "craft") throw err;
        return "ok";
      });
      await expect(withProFallback(true, "craft", run)).resolves.toEqual({ value: "ok", downgraded: true });
    }
  });

  it("doesn't fall back when the key itself is rejected", async () => {
    const bad = new Error("Your Google Gemini key was rejected. Check you copied the whole key.");
    const run = vi.fn(async () => {
      throw bad;
    });
    await expect(withProFallback(true, "craft", run)).rejects.toBe(bad);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("leaves Anthropic keys and fast calls alone", async () => {
    const run = vi.fn(async () => {
      throw noFreeTier;
    });
    await expect(withProFallback(false, "craft", run)).rejects.toBe(noFreeTier);
    await expect(withProFallback(true, "fast", run)).rejects.toBe(noFreeTier);
  });
});
