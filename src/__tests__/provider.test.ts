import { describe, it, expect } from "vitest";
import { chooseProvider, isBuiltInAiAllowed } from "@/lib/provider";

describe("chooseProvider", () => {
  it("returns null when no keys are provided", () => {
    expect(chooseProvider({})).toBeNull();
  });

  it("returns null when all keys are empty strings", () => {
    expect(chooseProvider({ userKey: "", serverAnthropicKey: "", gatewayKey: "" })).toBeNull();
  });

  it("returns null when keys are only whitespace", () => {
    expect(chooseProvider({ userKey: "   ", serverAnthropicKey: "\t", gatewayKey: " " })).toBeNull();
  });

  it("uses user key first (ownerPays: false)", () => {
    const result = chooseProvider({
      userKey: "sk-user-123",
      serverAnthropicKey: "sk-server-456",
      gatewayKey: "gw-789",
    });
    expect(result).toEqual({ via: "anthropic", key: "sk-user-123", ownerPays: false });
  });

  it("trims whitespace from the user key", () => {
    const result = chooseProvider({ userKey: "  sk-trimmed  " });
    expect(result).toEqual({ via: "anthropic", key: "sk-trimmed", ownerPays: false });
  });

  it("falls back to server key when no user key (ownerPays: true)", () => {
    const result = chooseProvider({
      serverAnthropicKey: "sk-server-456",
      gatewayKey: "gw-789",
    });
    expect(result).toEqual({ via: "anthropic", key: "sk-server-456", ownerPays: true });
  });

  it("falls back to gateway key last (ownerPays: true)", () => {
    const result = chooseProvider({ gatewayKey: "gw-789" });
    expect(result).toEqual({ via: "gateway", key: "gw-789", ownerPays: true });
  });

  it("skips empty user key and uses server key", () => {
    const result = chooseProvider({ userKey: "", serverAnthropicKey: "sk-server-456" });
    expect(result).toEqual({ via: "anthropic", key: "sk-server-456", ownerPays: true });
  });

  it("skips whitespace user key and uses gateway key", () => {
    const result = chooseProvider({ userKey: "  ", serverAnthropicKey: "  ", gatewayKey: "gw-789" });
    expect(result).toEqual({ via: "gateway", key: "gw-789", ownerPays: true });
  });
});

describe("chooseProvider: Gemini", () => {
  it("routes a user Google key with an AQ. prefix to gemini", () => {
    const result = chooseProvider({ userKey: "AQ.exampleKey" });
    expect(result).toEqual({ via: "gemini", key: "AQ.exampleKey", ownerPays: false });
  });

  it("routes a user Gemini key (AIza…) to gemini, not rate-limited", () => {
    const result = chooseProvider({ userKey: "AIzaSyExampleKey123" });
    expect(result).toEqual({ via: "gemini", key: "AIzaSyExampleKey123", ownerPays: false });
  });

  it("routes a user Anthropic key to anthropic even when a server Gemini key exists", () => {
    const result = chooseProvider({ userKey: "sk-ant-user", serverGeminiKey: "AIzaServer" });
    expect(result).toEqual({ via: "anthropic", key: "sk-ant-user", ownerPays: false });
  });

  it("uses the server Anthropic key before the server Gemini key", () => {
    const result = chooseProvider({ serverAnthropicKey: "sk-ant-server", serverGeminiKey: "AIzaServer" });
    expect(result).toEqual({ via: "anthropic", key: "sk-ant-server", ownerPays: true });
  });

  it("falls back to the server Gemini key (ownerPays: true) before the gateway", () => {
    const result = chooseProvider({ serverGeminiKey: "AIzaServer", gatewayKey: "gw-789" });
    expect(result).toEqual({ via: "gemini", key: "AIzaServer", ownerPays: true });
  });

  it("skips an empty server Gemini key and uses the gateway", () => {
    const result = chooseProvider({ serverGeminiKey: "  ", gatewayKey: "gw-789" });
    expect(result).toEqual({ via: "gateway", key: "gw-789", ownerPays: true });
  });
});

describe("chooseProvider: own-key mode", () => {
  it("ignores every server key when built-in AI is not allowed", () => {
    expect(
      chooseProvider({
        serverAnthropicKey: "sk-ant-server",
        serverGeminiKey: "AIzaServer",
        gatewayKey: "gw-789",
        allowBuiltIn: false,
      }),
    ).toBeNull();
  });

  it("still uses the caller's own key when built-in AI is not allowed", () => {
    expect(chooseProvider({ userKey: "AIzaUser", gatewayKey: "gw", allowBuiltIn: false })).toEqual({
      via: "gemini",
      key: "AIzaUser",
      ownerPays: false,
    });
  });

  it("only allows built-in AI when the flag is exactly 'true'", () => {
    expect(isBuiltInAiAllowed({})).toBe(false);
    expect(isBuiltInAiAllowed({ ALLOW_BUILT_IN_AI: "1" })).toBe(false);
    expect(isBuiltInAiAllowed({ ALLOW_BUILT_IN_AI: "true" })).toBe(true);
  });
});
