import { describe, it, expect } from "vitest";
import {
  tokenFromHash,
  encodeShare,
  decodeShare,
  shareUrl,
  exportText,
  exportMarkdown,
  type SharePayload,
} from "@/lib/share";

const SAMPLE: SharePayload = {
  v: 1,
  title: "Neon Nights",
  style: "synthwave, 80s, dark, driving",
  exclude: "country, acoustic",
  vocal: "haunting female lead",
  lyrics: "[Verse]\nNeon lights in the rain\nFade away once again",
};

// ── tokenFromHash ────────────────────────────────────────────────────────────

describe("tokenFromHash", () => {
  it("extracts the token from a valid #share= hash", () => {
    expect(tokenFromHash("#share=z.abc123")).toBe("z.abc123");
  });

  it("handles URL-safe base64 characters (-, _, .)", () => {
    expect(tokenFromHash("#share=r.aB-C_D.E")).toBe("r.aB-C_D.E");
  });

  it("returns null for an empty string", () => {
    expect(tokenFromHash("")).toBeNull();
  });

  it("returns null when hash has no #share= prefix", () => {
    expect(tokenFromHash("#other=z.abc")).toBeNull();
  });

  it("returns null for a bare # with no token", () => {
    expect(tokenFromHash("#share=")).toBeNull();
  });

  it("returns null if the token contains invalid characters (=)", () => {
    // Padding characters should have been stripped by toB64Url
    expect(tokenFromHash("#share=abc==")).toBeNull();
  });
});

// ── encodeShare / decodeShare round-trip ────────────────────────────────────

describe("encodeShare / decodeShare round-trip", () => {
  it("round-trips a full payload", async () => {
    const token = await encodeShare(SAMPLE);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    const result = await decodeShare(token);
    expect(result).toEqual(SAMPLE);
  });

  it("produces a token starting with 'z.' (compressed) or 'r.' (raw)", async () => {
    const token = await encodeShare(SAMPLE);
    expect(token.startsWith("z.") || token.startsWith("r.")).toBe(true);
  });

  it("round-trips a payload with empty optional fields", async () => {
    const minimal: SharePayload = { v: 1, title: "Test", style: "pop", exclude: "", vocal: "", lyrics: "" };
    const token = await encodeShare(minimal);
    const result = await decodeShare(token);
    expect(result).toEqual(minimal);
  });

  it("round-trips lyrics with newlines and special characters", async () => {
    const p: SharePayload = { ...SAMPLE, lyrics: "Line 1\nLine 2\nLine 3 — em dash & «guillemets»" };
    const result = await decodeShare(await encodeShare(p));
    expect(result?.lyrics).toBe(p.lyrics);
  });
});

// ── decodeShare error cases ──────────────────────────────────────────────────

describe("decodeShare — malformed input", () => {
  it("returns null for an empty string", async () => {
    expect(await decodeShare("")).toBeNull();
  });

  it("returns null for an unknown prefix", async () => {
    expect(await decodeShare("x.abc123")).toBeNull();
  });

  it("returns null for invalid base64", async () => {
    expect(await decodeShare("r.!!!")).toBeNull();
  });

  it("returns null for a 'z.' token that is not valid deflate data", async () => {
    // 'r.' + something that base64-decodes to random bytes
    // Encode random bytes as r. then try to decode as z.
    const raw = "z.YWJjZGVm"; // base64 of 'abcdef', not valid deflate
    expect(await decodeShare(raw)).toBeNull();
  });

  it("returns null for a payload missing required fields", async () => {
    const partial = JSON.stringify({ v: 1, title: "X" }); // no style/exclude/vocal/lyrics
    const bytes = new TextEncoder().encode(partial);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await decodeShare(`r.${b64}`)).toBeNull();
  });

  it("returns null when title exceeds the 200-char limit", async () => {
    const p: SharePayload = { ...SAMPLE, title: "A".repeat(201) };
    const token = await encodeShare(p);
    expect(await decodeShare(token)).toBeNull();
  });

  it("returns null for a token that decodes to non-JSON", async () => {
    const bytes = new TextEncoder().encode("not json!!");
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await decodeShare(`r.${b64}`)).toBeNull();
  });
});

// ── shareUrl ─────────────────────────────────────────────────────────────────

describe("shareUrl", () => {
  it("builds the correct URL", () => {
    expect(shareUrl("https://example.com", "/", "z.tok123")).toBe(
      "https://example.com/#share=z.tok123",
    );
  });

  it("preserves a non-root path", () => {
    expect(shareUrl("https://app.example.com", "/studio", "r.abc")).toBe(
      "https://app.example.com/studio#share=r.abc",
    );
  });
});

// ── exportText ───────────────────────────────────────────────────────────────

describe("exportText", () => {
  it("includes title, style, and lyrics", () => {
    const out = exportText(SAMPLE);
    expect(out).toContain("TITLE\nNeon Nights");
    expect(out).toContain("STYLE OF MUSIC\nsynthwave, 80s, dark, driving");
    expect(out).toContain("LYRICS\n[Verse]");
  });

  it("includes exclude styles when non-empty", () => {
    expect(exportText(SAMPLE)).toContain("EXCLUDE STYLES\ncountry, acoustic");
  });

  it("omits exclude styles when empty", () => {
    const out = exportText({ ...SAMPLE, exclude: "" });
    expect(out).not.toContain("EXCLUDE STYLES");
  });

  it("includes vocal line when non-empty", () => {
    expect(exportText(SAMPLE)).toContain("VOCAL LINE\nhaunting female lead");
  });

  it("omits vocal line when empty", () => {
    const out = exportText({ ...SAMPLE, vocal: "" });
    expect(out).not.toContain("VOCAL LINE");
  });
});

// ── exportMarkdown ───────────────────────────────────────────────────────────

describe("exportMarkdown", () => {
  it("has the title as an h1", () => {
    expect(exportMarkdown(SAMPLE)).toMatch(/^# Neon Nights/);
  });

  it("wraps style in a code fence", () => {
    expect(exportMarkdown(SAMPLE)).toContain("```\nsynthwave, 80s, dark, driving\n```");
  });

  it("falls back to 'Untitled' for an empty title", () => {
    expect(exportMarkdown({ ...SAMPLE, title: "" })).toMatch(/^# Untitled/);
  });

  it("omits exclude section when empty", () => {
    const out = exportMarkdown({ ...SAMPLE, exclude: "" });
    expect(out).not.toContain("Exclude styles");
  });

  it("omits vocal section when empty", () => {
    const out = exportMarkdown({ ...SAMPLE, vocal: "" });
    expect(out).not.toContain("Vocal line");
  });
});
