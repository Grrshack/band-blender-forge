import { describe, expect, it } from "vitest";
import { PHONE_AUDIO_WARN_BYTES, isLikelyPhone, largeAudioWarning } from "@/lib/audio/large-file";

describe("large audio on phones", () => {
  it("only warns on phones, above the limit", () => {
    expect(largeAudioWarning(PHONE_AUDIO_WARN_BYTES + 1, true)).toMatch(/MP3/);
    expect(largeAudioWarning(PHONE_AUDIO_WARN_BYTES - 1, true)).toBeNull();
    expect(largeAudioWarning(500 * 1024 * 1024, false)).toBeNull();
  });
  it("says how big the file is", () => {
    expect(largeAudioWarning(85 * 1024 * 1024, true)).toMatch(/85 MB/);
  });
  it("treats narrow touch screens as phones", () => {
    expect(isLikelyPhone(390, true)).toBe(true);
    expect(isLikelyPhone(390, false)).toBe(false);
    expect(isLikelyPhone(1440, true)).toBe(false);
  });
});
