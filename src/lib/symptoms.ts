/** What can be wrong with a Suno take. Shared by Fix a Track and the Band Blender's take check. */
export const SYMPTOMS = [
  "Vocals sound robotic or over-polished",
  "Vocals buried or unclear",
  "Wrong vocal style or gender",
  "Bass is buried",
  "Bass is boomy or muddy",
  "Too fast",
  "Too slow",
  "Wrong genre",
  "Generic, sounds like AI",
  "Mix is too busy",
  "Sounds thin or weak",
  "Harsh, piercing highs",
  "Too repetitive",
  "Ending is abrupt",
  "Ignored my lyrics",
] as const;

/** The handful shown as quick picks right after a disappointing first take. */
export const QUICK_SYMPTOMS: readonly string[] = [
  "Wrong genre",
  "Vocals sound robotic or over-polished",
  "Wrong vocal style or gender",
  "Bass is boomy or muddy",
  "Generic, sounds like AI",
  "Mix is too busy",
];

/** Adds new picks to existing ones without duplicates, keeping the original order. */
export function mergeSymptoms(existing: readonly string[], added: readonly string[]): string[] {
  const out = [...existing];
  for (const s of added) if (!out.includes(s)) out.push(s);
  return out;
}
