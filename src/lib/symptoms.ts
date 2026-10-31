/** What can be wrong with a Suno take. Shared by Fix a Track and the Band Blender's take check. */
export const SYMPTOMS = [
  "Vocals sound robotic or over-polished",
  "Vocals buried or unclear",
  "Vocal sounds far away",
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
  "Verses go quiet or empty",
  "Ending is abrupt",
  "Cut off before the last lyric",
  "Outro drags on",
  "Whole mix is muddy",
  "Ignored my lyrics",
  "Words sung wrong",
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

/** Quick picks after a take made with Lyric Forge's lyrics. */
export const LYRIC_QUICK_SYMPTOMS: readonly string[] = [
  "Ignored my lyrics",
  "Words sung wrong",
  "Too repetitive",
  "Cut off before the last lyric",
  "Vocal sounds far away",
  "Wrong vocal style or gender",
];

/** Adds new picks to existing ones without duplicates, keeping the original order. */
export function mergeSymptoms(existing: readonly string[], added: readonly string[]): string[] {
  const out = [...existing];
  for (const s of added) if (!out.includes(s)) out.push(s);
  return out;
}

/**
 * What usually works for each symptom, in Band Blender's words. Sent to the AI with the
 * symptoms the person picked, so its fix starts from a known-good move.
 */
export const SYMPTOM_PLAYBOOK: Partial<Record<(typeof SYMPTOMS)[number], string>> = {
  "Vocals buried or unclear": "say the lead vocal is upfront and dry, above the band; add buried vocals to Exclude styles",
  "Vocal sounds far away": "soft or intimate words without placement push the voice back: describe it as close-miked, dry and upfront; exclude heavy reverb and distant vocals",
  "Verses go quiet or empty": "say the band keeps playing through the verses with steady energy; give the verses a named part (bass line, muted guitar); exclude empty verses",
  "Ending is abrupt": "end the lyrics with an [Instrumental Outro] section and [End]; ask for a short instrumental outro that resolves",
  "Cut off before the last lyric": "the song ran out of time: shorten the lyrics or drop a section, put an [Instrumental Outro] and [End] after the last line, or extend the take from just before the cut",
  "Outro drags on": "ask for a short instrumental outro and a clean stop; add fade-out and long outro to Exclude styles; end the lyrics with [End]",
  "Whole mix is muddy": "fewer instruments, a defined low end and clear separation in the style; a mastering EQ cut around 200-400 Hz often helps more than regenerating",
};

/**
 * Ways to keep a take that is mostly right. Shown in Fix a Track and offered to the AI.
 */
export const KEEP_WHAT_WORKS = [
  { title: "Replace one section", body: "Keep the take and regenerate only the part that's wrong (a chorus, the bridge) with Suno's section replace or edit." },
  { title: "Extend from before it went wrong", body: "If the song falls apart at 2:10, extend from about 2:00 so the good part stays and only the rest is redone." },
  { title: "Splice two takes", body: "When one take has the better verse and another the better chorus, use the good section of one as the start and extend or cover from there." },
  { title: "Try Simple mode once", body: "Paste just the idea in a sentence into Simple mode. If it sounds better, your detailed prompt is fighting itself." },
] as const;
