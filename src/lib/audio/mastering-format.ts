/** Number formatting and control-group ids shared by the Mastering Lab screens. */
export const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
export const fmtDb = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)} dB`;

export type GroupId = "bass" | "lowband" | "sub" | "finish";
export const ALL_GROUPS: GroupId[] = ["bass", "lowband", "sub", "finish"];
