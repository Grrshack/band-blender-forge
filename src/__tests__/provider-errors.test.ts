import { describe, expect, it } from "vitest";

import { parseRateLimit, rateLimitMessage } from "@/lib/provider-errors";

// Shapes based on Google's RESOURCE_EXHAUSTED errors (OpenAI-compatible endpoint wraps them in an array).
const noFreeTier = `[{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro-preview","status":"RESOURCE_EXHAUSTED"}}]`;
const perMinute = `[{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 10, model: gemini-3.8-flash. Please retry in 31.2s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"31s"}]}}]`;
const perDay = `[{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 250","status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}]`;

describe("parseRateLimit", () => {
  it("spots a model with no free-tier allowance", () => {
    expect(parseRateLimit(noFreeTier)).toEqual({ kind: "unavailable", retryMs: null });
  });

  it("reads a per-minute limit and Google's suggested wait", () => {
    expect(parseRateLimit(perMinute)).toEqual({ kind: "minute", retryMs: 31000 });
  });

  it("spots a used-up daily allowance", () => {
    expect(parseRateLimit(perDay).kind).toBe("day");
  });

  it("falls back to unknown for a bare 429", () => {
    expect(parseRateLimit("Too Many Requests")).toEqual({ kind: "unknown", retryMs: null });
  });
});

describe("rateLimitMessage", () => {
  it("tells free Google users what to do", () => {
    expect(rateLimitMessage("gemini", { kind: "unavailable", retryMs: null })).toContain("free tier");
    expect(rateLimitMessage("gemini", { kind: "minute", retryMs: 31000 })).toContain("31 seconds");
    expect(rateLimitMessage("gemini", { kind: "day", retryMs: null })).toContain("midnight Pacific");
  });
});
