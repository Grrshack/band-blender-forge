import { describe, expect, it } from "vitest";
import { buildStudioHref, legacyStudioRedirect, readHandoff } from "@/lib/handoff";

const search = (href: string) => href.slice(href.indexOf("?"));

describe("landing → studio handoff", () => {
  it("round-trips a description with sliders and model", () => {
    const href = buildStudioHref({
      kind: "describe",
      text: "  90s grunge   with synthwave chorus ",
      sliders: { energy: 70.4, complexity: 50, brightness: 120 },
      sunoVersion: "wild",
    })!;
    expect(href.startsWith("/studio?")).toBe(true);
    const got = readHandoff(search(href))!;
    expect(got.handoff).toEqual({ kind: "describe", text: "90s grunge with synthwave chorus" });
    expect(got.sliders).toEqual({ energy: 70, complexity: 50, brightness: 100 });
    expect(got.sunoVersion).toBe("wild");
  });

  it("keeps up to three non-empty artists", () => {
    const href = buildStudioHref({ kind: "artists", artists: ["Portishead", "", "Björk", "Massive Attack", "Extra"] })!;
    expect(readHandoff(search(href))!.handoff).toEqual({
      kind: "artists",
      artists: ["Portishead", "Björk", "Massive Attack"],
    });
  });

  it("handles one song and encodes special characters", () => {
    const href = buildStudioHref({ kind: "song", song: "Rock & Roll? #1" })!;
    expect(readHandoff(search(href))!.handoff).toEqual({ kind: "song", song: "Rock & Roll? #1" });
  });

  it("returns null when nothing was typed", () => {
    expect(buildStudioHref({ kind: "describe", text: "   " })).toBeNull();
    expect(buildStudioHref({ kind: "artists", artists: ["", " "] })).toBeNull();
    expect(readHandoff("?tab=lyrics")).toBeNull();
    expect(readHandoff("")).toBeNull();
  });

  it("ignores partial or bad slider values and unknown models", () => {
    const got = readHandoff("?describe=hi&e=10&c=abc&b=5&v=pro")!;
    expect(got.sliders).toBeNull();
    expect(got.sunoVersion).toBe("v6");
  });

  it("caps very long text", () => {
    const got = readHandoff(`?describe=${"a".repeat(2000)}`)!;
    expect(got.handoff.kind === "describe" && got.handoff.text.length).toBe(500);
  });
});

describe("old links to / still reach the studio", () => {
  it("forwards tab, remix, share and sign-in returns", () => {
    expect(legacyStudioRedirect("?tab=genres&card=x", "")).toBe("/studio?tab=genres&card=x");
    expect(legacyStudioRedirect("?remix=abc", "")).toBe("/studio?remix=abc");
    expect(legacyStudioRedirect("", "#share=tok_1")).toBe("/studio#share=tok_1");
    expect(legacyStudioRedirect("", "#access_token=x&type=signup")).toBe("/studio#access_token=x&type=signup");
    expect(legacyStudioRedirect("?code=123", "")).toBe("/studio?code=123");
  });

  it("leaves ordinary landing visits alone", () => {
    expect(legacyStudioRedirect("", "")).toBeNull();
    expect(legacyStudioRedirect("?utm_source=reddit", "#faq")).toBeNull();
  });
});
