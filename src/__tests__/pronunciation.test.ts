import { describe, expect, it } from "vitest";

import { findPronunciationRisks, numberToWords } from "@/lib/pronunciation";

describe("numberToWords", () => {
  it("spells out small numbers, tens and years", () => {
    expect(numberToWords(7)).toBe("seven");
    expect(numberToWords(24)).toBe("twenty-four");
    expect(numberToWords(1999)).toBe("nineteen ninety-nine");
    expect(numberToWords(1905)).toBe("nineteen oh-five");
    expect(numberToWords(300)).toBe("three hundred");
  });
});

describe("findPronunciationRisks", () => {
  it("catches digits, times and symbols", () => {
    const risks = findPronunciationRisks("Working 24/7 till 3am & back");
    expect(risks.map((r) => r.word)).toEqual(["24/7", "3am", "&"]);
    expect(risks[0]!.suggestion).toBe("twenty-four seven");
    expect(risks[1]!.suggestion).toBe("three A.M.");
    expect(risks[2]!.suggestion).toBe("and");
  });

  it("flags unusual capital abbreviations but not common ones", () => {
    expect(findPronunciationRisks("The DJ played it on TV").map((r) => r.word)).toEqual(["DJ"]);
    expect(findPronunciationRisks("I said OK").length).toBe(0);
  });

  it("flags words with two pronunciations once each", () => {
    const risks = findPronunciationRisks("We live to read, we live to lead");
    expect(risks.map((r) => r.word)).toEqual(["live", "read", "lead"]);
  });

  it("leaves an ordinary line alone", () => {
    expect(findPronunciationRisks("Headlights on the empty road")).toEqual([]);
  });
});
