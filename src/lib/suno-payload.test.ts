import { describe, expect, it } from "vitest";
import { instrumentalFor, sunoExtras, sunoPayloadFrom } from "./suno-payload";
import { withAlternates } from "./alt-takes";
import { versionAtLeast } from "@/components/forge/SunoOptionsCard";
import { emptyState } from "@/components/forge/types";

describe("what Send to Suno carries", () => {
  it("leaves Suno's own settings alone unless you set them", () => {
    const s = emptyState();
    expect(sunoExtras(s.blend, [])).toEqual({});
    s.blend.sunoOptions = { vocalGender: "female", weirdness: 40.4, styleInfluence: 140 };
    expect(sunoExtras(s.blend, [])).toEqual({ vocalGender: "female", weirdness: 40, styleInfluence: 100 });
  });

  it("switches Instrumental only for songs with sections but no sung lines", () => {
    expect(instrumentalFor([])).toBeUndefined();
    expect(instrumentalFor([{ tag: "[Intro]", lines: [] }, { tag: "[Drop]", lines: [{ text: " ", locked: false }] }])).toBe(true);
    expect(instrumentalFor([{ tag: "[Verse]", lines: [{ text: "hello", locked: false }] }])).toBe(false);
  });

  it("sends every take with the open one marked", () => {
    const s = emptyState();
    s.lyrics.title = "Neon";
    s.blend.result = withAlternates({ styleTag: "synthpop", excludeStyles: "autotune" }, [
      { id: "darker-1", label: "Darker", styleTag: "dark synthpop", excludeStyles: "brightness" },
    ]);
    const p = sunoPayloadFrom(s);
    expect(p.style).toBe("synthpop");
    expect(p.takes).toEqual([
      { label: "Main", style: "synthpop", exclude: "autotune" },
      { label: "Darker", style: "dark synthpop", exclude: "brightness" },
    ]);
    expect(p.activeTake).toBe(0);
  });

  it("compares extension versions", () => {
    expect(versionAtLeast("1.0.0", "1.1.0")).toBe(false);
    expect(versionAtLeast("1.1.0", "1.1.0")).toBe(true);
    expect(versionAtLeast("1.10.0", "1.2.0")).toBe(true);
    expect(versionAtLeast(null, "1.1.0")).toBe(false);
  });
});
