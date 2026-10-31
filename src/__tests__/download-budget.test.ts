import { describe, expect, it } from "vitest";

import { budget, cycleStart, findDuplicate, nextReset, recordDownload } from "@/lib/download-budget";
import { newTake } from "@/lib/takes";

describe("download budget", () => {
  const now = new Date(2026, 9, 31, 12); // Oct 31, 2026, local time

  it("counts only this cycle on monthly plans", () => {
    const t1 = newTake("a", "", 5, "", new Date(2026, 9, 2));
    const t2 = newTake("b", "", 5, "", new Date(2026, 9, 20));
    let ev = recordDownload([], t1, true, "Song A", new Date(2026, 9, 2));
    ev = recordDownload(ev, t2, true, "Song B", new Date(2026, 9, 20));
    // Resets on the 14th: Oct 2 belongs to the previous cycle.
    expect(budget(ev, { plan: "pro", resetDay: 14 }, now)).toMatchObject({ used: 1, limit: 20, left: 19, monthly: true });
    expect(budget(ev, { plan: "free", resetDay: 14 }, now)).toMatchObject({ used: 2, limit: 7, monthly: false, resetsOn: null });
  });

  it("unticking removes the download, and ticking twice counts once", () => {
    const t = newTake("a", "", 5, "");
    let ev = recordDownload([], t, true, "x", now);
    ev = recordDownload(ev, t, true, "x", now);
    expect(ev).toHaveLength(1);
    expect(recordDownload(ev, t, false, "x", now)).toHaveLength(0);
  });

  it("finds the cycle start and next reset", () => {
    expect(cycleStart(14, now).getDate()).toBe(14);
    expect(cycleStart(14, now).getMonth()).toBe(9);
    expect(cycleStart(28, new Date(2026, 10, 3)).getMonth()).toBe(9); // Nov 3 → Oct 28
    expect(nextReset(14, now).getMonth()).toBe(10);
  });
});

describe("duplicate takes", () => {
  const takes = [
    newTake("dark trip-hop, 84 bpm, dusty drums, sub bass, female vocal, rhodes, vinyl, moody, slow, smoky", "autotune", 2, ""),
    newTake("indie rock, 120 bpm", "", 4, ""),
  ];

  it("spots the exact same prompt", () => {
    expect(findDuplicate(takes, "Indie rock,  120 BPM", "")?.kind).toBe("same");
  });

  it("spots a near copy, but not a real change", () => {
    const near = "dark trip-hop, 84 bpm, dusty drums, sub bass, female vocal, rhodes, vinyl, moody, slow, smoky, haunting";
    expect(findDuplicate(takes, near, "autotune")?.kind).toBe("near");
    expect(findDuplicate(takes, "dark trip-hop, 84 bpm, live drums", "autotune")).toBeNull();
  });
});
