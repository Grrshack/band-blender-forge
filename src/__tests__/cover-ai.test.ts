import { afterEach, describe, expect, it, vi } from "vitest";

import { CoverAiError, errorFromStatus, generateCoverImage, imageFromResponse } from "@/lib/cover-ai";

const PNG_B64 = "iVBORw0KGgo="; // a few PNG header bytes; enough for a blob

describe("reading Google's image response", () => {
  it("finds the image part", () => {
    const r = imageFromResponse({ candidates: [{ content: { parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: PNG_B64 } }] } }] });
    expect(r).toEqual({ data: PNG_B64, mime: "image/png" });
  });
  it("explains a safety block", () => {
    expect(() => imageFromResponse({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] })).toThrow(/safety/);
    expect(() => imageFromResponse({ promptFeedback: { blockReason: "OTHER" } })).toThrow(/blocked/);
  });
});

describe("error messages", () => {
  it("names the fix for a free key without image access", () => {
    const e = errorFromStatus(429, '{"error":{"message":"Quota exceeded... limit: 0, model: gemini-3.1-flash-image"}}');
    expect(e.kind).toBe("quota");
    expect(e.message).toMatch(/billing/);
  });
  it("spots a bad key", () => {
    expect(errorFromStatus(400, "API_KEY_INVALID").kind).toBe("key");
  });
});

describe("generateCoverImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to the older model when the newer one needs billing", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("gemini-3.1")) return new Response('{"error":"limit: 0"}', { status: 429 });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG_B64 } }] } }] }), { status: 200 });
      }),
    );
    const r = await generateCoverImage("AIzaTEST", "a photo");
    expect(r.model).toBe("gemini-2.5-flash-image");
    expect(r.blob.type).toBe("image/png");
    expect(calls).toHaveLength(2);
  });

  it("stops at once on a rejected key", async () => {
    const f = vi.fn(async () => new Response("API_KEY_INVALID", { status: 400 }));
    vi.stubGlobal("fetch", f);
    await expect(generateCoverImage("bad", "x")).rejects.toBeInstanceOf(CoverAiError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
