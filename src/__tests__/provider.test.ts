import { describe, it, expect } from "vitest";
import { chooseProvider } from "@/lib/provider";

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
