import { lyricStyleRules } from "./rhyme";
import { SYMPTOM_PLAYBOOK } from "./symptoms";
import {
  LYRIC_CHAR_BUDGET,
  LYRIC_NOTATION_RULE,
  VOCAL_PLACEMENT_RULE,
  looksLikeBrief,
  normalizePromptFormat,
  styleFieldSpec,
  styleRule,
  type PromptFormat,
} from "@/lib/prompt-craft";
import { bannedWordsInstruction } from "@/lib/banned-words";
import { bannedListForPrompt, type ClicheHit } from "@/lib/cliches";
import {
  normalizeSunoVersion,
  STYLE_TARGET,
  STYLE_TARGET_FOR_VERSION,
  SUNO_VERSION_NAMES,
  type SunoVersion,
} from "@/lib/suno";

export const SYSTEM = `You are a pre-production planning engine for AI music generation (Suno-style).
You are ruthlessly specific. You never produce generic AI-slop language.
Banned lyric crutches (never use these or close variants): ${bannedListForPrompt()}.
Prioritise hook catchiness, syllabic rhythm and singability over end-rhyme.
Suno rejects real artist names, so NEVER write a real artist, band, producer, label or song title
into any style, genre, vocal or exclude field. Describe the sound instead: genre, tempo, instruments,
vocal timbre and delivery, production traits. Only a "reconciliation" explanation may name artists.
Always reply with ONLY raw JSON. No markdown fences, no commentary.`;

const LYRIC_TASKS = new Set(["lyrics", "regenLine", "regenSection"]);

export function prompt(task: string, payload: Record<string, unknown>): string {
  const body = promptBody(task, payload);
  if (!LYRIC_TASKS.has(task)) return body;
  const banned = Array.isArray(payload["bannedWords"])
    ? (payload["bannedWords"] as unknown[]).filter((w): w is string => typeof w === "string")
    : [];
  return body + bannedWordsInstruction(banned);
}

/** Known-good starting moves for the symptoms the person picked. */
function playbookFor(symptoms: unknown): string {
  if (!Array.isArray(symptoms)) return "";
  const lines = symptoms
    .filter((x): x is string => typeof x === "string")
    .map((x) => {
      const move = SYMPTOM_PLAYBOOK[x as keyof typeof SYMPTOM_PLAYBOOK];
      return move ? `    "${x}": ${move}` : "";
    })
    .filter(Boolean);
  return lines.length ? `- Starting points that usually work for the picked symptoms:\n${lines.join("\n")}\n` : "";
}

/** The format to write a style in: what the user picked, or the format of the style being revised. */
function formatOf(payload: Record<string, unknown>, styleKey: string): PromptFormat {
  if (payload["promptFormat"] !== undefined) return normalizePromptFormat(payload["promptFormat"]);
  const st = payload[styleKey];
  return typeof st === "string" && looksLikeBrief(st) ? "brief" : "tags";
}

function promptBody(task: string, payload: Record<string, unknown>): string {
  const p = JSON.stringify(payload);
  switch (task) {
    case "blend": {
      const version: SunoVersion = normalizeSunoVersion(payload["sunoVersion"]);
      const vTarget = STYLE_TARGET_FOR_VERSION[version];
      const vLabel = SUNO_VERSION_NAMES[version];
      const vNote =
        version === "mini"
          ? "Keep the style tag concise and punchy — v6-mini responds better to short, direct prompts than long tag lists."
          : version === "wild"
            ? "v6-wild is deliberately less predictable — anchor genre, tempo and mood clearly up front, then leave room for surprise instead of specifying every instrument."
            : "v6 understands musician vocabulary and natural language well — mix descriptive phrases with genre tags rather than tag-only lists, and use the budget where it adds specificity.";
      const targetGenre =
        typeof payload["targetGenre"] === "string" ? payload["targetGenre"].trim() : "";
      const genreLock = payload["genreLock"] === true;
      const genreNote = targetGenre
        ? genreLock
          ? `\nGENRE LOCK — HARD CONSTRAINT: The final style tag MUST be rooted in ${targetGenre}. Resolve all conflicting elements in favor of ${targetGenre} conventions. The genre field must list ${targetGenre} first.`
          : `\nGenre bias: Lean the blend toward ${targetGenre}. Where artist elements conflict, favour ${targetGenre} conventions. You may still incorporate outside elements when they genuinely serve the blend.`
        : "";
      const targetEra = typeof payload["targetEra"] === "string" ? payload["targetEra"].trim() : "";
      const eraNote = targetEra
        ? `\nEra targeting: Bias the production sound, mix conventions, and instrumentation toward ${targetEra} aesthetics. This applies to production choices (compression, reverb style, drum sound) as well as harmonic and rhythmic conventions of that period.`
        : "";
      return `Blend these artists into one coherent, produceable style for ${vLabel}.
Target: ${vLabel}. ${vNote}${genreNote}${eraNote}
Input: ${p}
The "sliders" values are user-set 0-100 targets; honour them and reflect them in the output.
Slider definitions (interpret user values against these exact meanings):
- energy: How intense and driving the track feels — low is sparse and restrained, high is aggressive and relentless.
- complexity: How intricate the arrangement is — low is simple and repetitive, high is layered and technical.
- brightness: The overall tonal character — low is dark and bass-heavy, high is crisp and shimmering.
Assess your own real familiarity with each named artist honestly.
Input may include "reference": real MusicBrainz data per artist (status found / not_found / unavailable, plus community genre tags). Treat tags for "found" artists as ground truth for genre; if an artist is "not_found", say so in confidence.note and lower your confidence.
Return JSON exactly:
{"confidence":{"level":"high"|"medium"|"low","note":"one sentence, e.g. High artist familiarity"},
"genre":"string","tempo":"string with BPM range and feel","instrumentation":"string",
"vocals":"one-sentence summary of the vocal sound","mood":"string",
"styleTag":"${styleFieldSpec("tags", vTarget)}",
"styleBrief":"the SAME sound as styleTag, written as ${styleFieldSpec("brief", vTarget)} Same genre, tempo, instruments and vocal as styleTag; only the format differs.",
"voiceTags":"Suno v6 bracket vocal tags to prepend to the lyrics field, e.g. '[Female Vocal]' or '[Male Vocal], [Whisper]'. Choose from: [Male Vocal] [Female Vocal] [Duet] [Choir] [Rap] [Whisper] [Falsetto] [Raw Vocals]. Max 2-3 tags. Empty string if not applicable.",
"vocalPrompt":{"voice":"timbre and range, e.g. warm breathy alto","delivery":"phrasing and performance, e.g. close-mic, half-spoken verses, belted chorus","harmonies":"backing-vocal treatment, or 'none'","effects":"vocal processing, e.g. tape echo, light pitch correction"},
"excludeStyles":"3-8 comma-separated traits to keep OUT of this sound (for Suno's Exclude styles box), e.g. 'autotune, trap hi-hats, EDM drop'",
"contradictions":"array of 0-3 short strings flagging any terms in the styleTag that may conflict with each other and confuse Suno v6 (e.g. 'acoustic and heavy bass may conflict'). Empty array [] if none found.",
"reconciliation":"2-4 sentences explaining exactly how conflicting elements of the chosen artists are fused, naming the specific conflicts and the resolution",
"recommendedSliders":{"energy":0-100,"complexity":0-100,"brightness":0-100},
"sliderNotes":"one sentence on why those values suit this blend"}
HARD RULE: every field except "reconciliation" must contain NO artist, band, producer, label or song names — not the input artists, not any other. Translate each influence into sonic description.\n${VOCAL_PLACEMENT_RULE}`;
    }
    case "lyrics": {
      const avoidWords = Array.isArray(payload["avoidWords"])
        ? (payload["avoidWords"] as string[])
        : [];
      const tagsOnly = payload["tagsOnly"] === true;
      const avoidNote =
        avoidWords.length > 0
          ? `\nSoft-avoid these words (used too often in recent generations — find fresh alternatives): ${avoidWords.map((w) => `"${w}"`).join(", ")}.`
          : "";
      const tagsNote = tagsOnly
        ? `\nTAGS-ONLY MODE: output section structure with NO lyric lines. Every section's "lines" array must be empty []. Generate a realistic song structure (tags, cues) only — the user will write the words.`
        : "";
      const introNote =
        payload["instrumentalIntro"] === true && !payload["structure"]
          ? `\nStart with an [Instrumental Intro] section ("lines":[]) before the first sung section.`
          : "";
      return `Write song lyrics for this brief.
Input: ${p}
Rules: hooks must be rhythmically repeatable and easy to sing; concrete images and specific nouns only;
avoid banned crutch phrases; vary line lengths; the chorus hook must land in its first 5 words.
Hook-craft rules (apply to every chorus):
- Favour open vowel sounds (ah, oh, ay, ee) on the syllable that lands on the strongest beat — these project further and read as catchier.
- The chorus hook phrase must repeat at least twice within the chorus itself.
- Apply the stranger test: would a stranger who heard this twice be able to sing back the hook? If not, simplify it.${avoidNote}${tagsNote}${introNote}${lyricStyleRules(payload["rhymeStyle"], payload["voice"])}
If "structure" is present in the input it is a plan: produce EXACTLY those sections, in that order, with exactly that many lyric lines in each (instrumental sections get "lines":[]). Do not add or drop sections.
Suno reads bracketed performance cues, so use them with purpose, not on every section:
- "cue" is an optional 1-4 word delivery direction for that section, e.g. "Whispered, sparse" or "Belted, full band".
- Include at most two instrumental sections (e.g. [Guitar Solo], [Instrumental Break]) with "lines":[] when the song needs one.
- Put ad-libs in parentheses inside a line only where they strengthen the hook, e.g. "(hey!)".
- Match cues to the linked style's vocal prompt; never put genre or instrument descriptions inside lyric lines.
Return JSON exactly:
{"title":"string, max 60 characters","sections":[{"tag":"[Verse 1]","cue":"optional short direction","lines":["line","line"]}]}
Use standard tags: [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Bridge] as appropriate. Open with [Instrumental Intro] (lines []) only when the song needs a lead-in. Unless the plan says otherwise, end with an [Instrumental Outro] section (lines []) after the last sung line rather than an [Outro] where words trail off; finishing every lyric before a short instrumental tail helps Suno end cleanly.
${LYRIC_NOTATION_RULE}
Length limit: Suno's lyrics box holds 5,000 characters including tags and cues. Keep the whole song (every tag, cue and line) under ${LYRIC_CHAR_BUDGET} characters; if the plan asks for more, shorten lines rather than drop sections.`;
    }
    case "intent":
      return `You are the studio assistant. Turn the user's latest message into settings for the Band Blender form.
Input: ${p}
"current" is the form as it is now; "history" is the recent chat. Treat follow-ups ("faster", "darker", "swap the second artist") as edits to "current" — keep anything the user didn't ask to change.
If the user names styles or moods but no artists, pick 2-3 well-known artists who define that sound.
Slider meanings (0-100): energy = how intense and driving (low sparse, high relentless); complexity = how intricate the arrangement (low simple, high layered/technical); brightness = tonal character (low dark/bass-heavy, high crisp/shimmering).
era must be "" or exactly one of: pre-70s, 70s, 80s, 90s, 00s, 2010s, current.
Return JSON exactly:
{"reply":"one or two short sentences saying what you set","artist_1":"string","artist_2":"string or empty","artist_3":"string or empty","target_genre":"short genre or empty","era":"string","energy":0,"complexity":0,"brightness":0}`;
    case "dossier":
      return `Build a release dossier for this finished song idea, ready for distribution and promotion.
Input: ${p}
Be specific to THIS song's sound and lyrics. No generic marketing filler. No real artist names in tags or art prompts.
Return JSON exactly:
{"titleOptions":["3 alternative release titles, max 60 chars each"],
"coverArtPrompt":"one detailed image-generation prompt for square album art: subject, palette, lighting, texture, typography-free",
"coverArtAlt":"a second, contrasting cover art direction",
"metadata":{"primaryGenre":"string","secondaryGenre":"string","moods":["3-5 mood tags"],"bpm":"estimate","key":"suggested key, e.g. A minor","explicit":false,"language":"string"},
"shortDescription":"one-sentence pitch, max 140 chars",
"bio":"3-4 sentence press/release description",
"playlistPitch":"2-3 sentences pitching to streaming playlist editors, naming the listener and moment",
"socialHooks":[{"platform":"TikTok"|"Reels"|"Shorts","hook":"on-screen text or caption","clip":"which lyric/section to clip"}],
"hashtags":["6-10 hashtags without spaces"],
"releaseTips":["3 concrete release-week actions"]}
Return exactly 3 socialHooks.`;
    case "regenLine":
      return `Rewrite ONE lyric line inside an existing song, keeping syllable count and rhythm close, keeping meaning coherent with neighbours, and avoiding clichés.${lyricStyleRules(payload["rhymeStyle"], payload["voice"])}
Input: ${p}
Return JSON exactly: {"line":"the new line"}`;
    case "regenSection": {
      const loosen = payload["loosenRhymes"] === true ? `
LOOSEN THE RHYMES: this section fell into the AABB/ABAB trap (almost every line ends on a clean one-syllable perfect rhyme). Keep the meaning, imagery and syllable counts close, but rewrite the line endings so at most one pair rhymes perfectly. Use slant rhymes, internal rhymes, or no rhyme; end some lines mid-thought; make it sound like someone talking, not a poem written to a meter.` : "";
      return `Rewrite ONE section of an existing song. Keep locked lines EXACTLY as given (they are marked locked).${loosen}${lyricStyleRules(payload["rhymeStyle"], payload["voice"])}
Input: ${p}
Return JSON exactly: {"tag":"[Chorus]","lines":["line","line"]}
Return the same number of lines, in order, with locked lines unchanged.`;
    }
    case "compare":
      return `Reverse-lookup: given user lyrics and/or style tags, name real-world recording artists whose tone matches.
Input: ${p}
Return JSON exactly:
{"summary":"one sentence describing the detected tone",
"artists":[{"name":"real artist","match":0-100,"reasoning":["specific bullet","specific bullet","specific bullet"]}]}
Return 3 or 4 artists, real and verifiable, most similar first.`;
    case "critique":
      return `You are a blunt A&R critic. Give honest, specific, unflattering-where-deserved feedback on this song draft.
Input: ${p}
No praise padding, no hedging, no "great start". Quote exact lines when criticising. Every criticism carries a concrete fix.
Return JSON exactly:
{"verdict":"2-3 sentences, brutally direct overall judgement",
"scores":[{"label":"Hook strength","score":0-10,"note":"one sentence"},{"label":"Imagery","score":0-10,"note":"..."},{"label":"Singability","score":0-10,"note":"..."},{"label":"Structure","score":0-10,"note":"..."},{"label":"Originality","score":0-10,"note":"..."}],
"cliches":[{"line":"the exact offending line","why":"why it is worn out","fix":"a specific rewritten line"}],
"prosody":[{"line":"the exact line","note":"why it is awkward to sing and how to re-stress it"}],
"fixFirst":["most important fix","second","third"]}
Return every score. Return an empty array where nothing qualifies.`;
    case "fixTake":
      return `You are a Suno prompt doctor. The user generated a take that came out wrong. Diagnose the causes, pick the best way to fix it, and revise the style prompt.
Input: ${p}
Rules:
- Change only what the complaints justify; keep everything else identical so the next take isolates the fix. Change at most 3 things.
- If "moments" is present, the user listened on Suno and noted problems at timestamps (m:ss). Tie each fix to its moment, and name the timestamp and section in sunoEdits targets (e.g. "Chorus 2, around 1:32").
- If "style" is empty the user didn't keep their prompt: write a fresh style prompt from the complaints, lyrics and audio instead of a revision.
- If "history" is present it lists earlier takes (oldest first) with 1-5 star ratings and notes. Use it: never repeat a change that coincided with a low rating, and keep what scored well.
- Be honest: Suno is stochastic and some problems (e.g. a voice that sounds synthetic) cannot be fully fixed by prompting. Say so in the diagnosis when it applies.
${playbookFor(payload["symptoms"])}- Common prompt-side causes: contradictory tags, too many tags diluting each other, genre words buried late, negatives written inside the style box instead of Exclude styles, conflicting tempo or energy words, instrument lists that crowd the mix.
- styleTag: the full revised style prompt. ${styleRule(formatOf(payload, "style"), STYLE_TARGET)} NO real artist, band, producer, label or song names.\n- ${VOCAL_PLACEMENT_RULE}
- excludeStyles: the full revised comma-separated exclude list, no artist names.
- lyricFixes: only if the complaints or lyrics justify it; quote the exact original line or section tag.
- If "audio" is present, it holds measurements of the actual generated file, taken in the user's browser:
    durationSec; clippedPercent (share of samples at full scale); contourDb (loudness across the song, up to 24 points, start to end);
    contrastDb (loud vs quiet parts; under ~3 dB means sections barely change in level); leadInSec (silence before the music);
    endTailDb (last second vs average; near 0 means the song stops abruptly);
    spectrum: peakDb, rmsDb, dynamicRangeDb, lowPeakHz, and bands (sub 20-80 Hz, bass 80-250, lowMid 250-500, mid 500-2k, highMid 2k-8k, air 8k-20k) in dB relative to the full-range level, measured on 30 s from the middle of the song.
    "flags" are findings the measurements already support; treat them as facts. Use the rest to confirm or question the user's complaints, and say plainly when the audio does not show what they describe.
    Mix-level problems (boomy or muddy low end, harsh highs, clipping, too quiet) are often better fixed in mastering than by regenerating.
- When a take is mostly right, keeping it beats starting over: replace one section, extend from just before the point it went wrong, or splice the good section of one take with another. Say which in routeWhy when it applies.
- Suno v6 can edit part of an existing song from a plain-language instruction (change one section, one instrument or one lyric) while keeping the rest. When the take is mostly good and the problem is local, prefer that: write sunoEdits the user can paste into Suno's edit feature. Each instruction must be specific and under 200 characters, name the part to change, and contain no real artist, band or song names. Leave sunoEdits empty when the problem is the whole song.
- fixRoute: "edit" if editing parts of this take is the best next step, "regenerate" if the prompt itself needs to change, "master" if the song is fine and only the mix needs treatment. routeWhy: one sentence.
Return JSON exactly:
{"fixRoute":"edit"|"regenerate"|"master","routeWhy":"one sentence",
"diagnosis":"2-3 plain sentences naming the most likely causes",
"sunoEdits":[{"target":"the part to change, e.g. Chorus 2, the bridge, the drums in verse 1","instruction":"plain-language edit for Suno v6"}],
"changes":[{"change":"what you changed in the prompt","why":"which complaint it targets"}],
"styleTag":"string","excludeStyles":"string",
"lyricFixes":[{"line":"exact original line or [Section Tag]","fix":"specific rewrite or structural change"}],
"tryNext":"one sentence: what to change FIRST if the next take is still off"}`;
    case "variants":
      return `Write three alternative Suno style prompts for the same song idea, so the user can generate three genuinely different takes.
Input: ${p}
The three variants, in this order:
1. "Safe": stays closest to the current style; the most predictable take.
2. "Experimental": change ONE dimension noticeably (tempo feel, lead instrument, production era or texture) while staying coherent.
3. "Hybrid": fuse the style with ONE contrasting genre. Name the genre, never an artist.
Rules: differences must be audible, not cosmetic — do not just reorder tags. For each styleTag: ${styleRule(formatOf(payload, "style"), STYLE_TARGET)} NO real artist, band, producer, label or song names anywhere. Each excludeStyles is 3-8 comma-separated traits.
Return JSON exactly:
{"variants":[{"label":"Safe","angle":"one sentence: what is different about this take","styleTag":"string","excludeStyles":"string","vocalLine":"one short line describing the vocal"},{"label":"Experimental","angle":"","styleTag":"","excludeStyles":"","vocalLine":""},{"label":"Hybrid","angle":"","styleTag":"","excludeStyles":"","vocalLine":""}]}`;
    case "refine": {
      const version: SunoVersion = normalizeSunoVersion(payload["sunoVersion"]);
      const vTarget = STYLE_TARGET_FOR_VERSION[version];
      const reimagine = typeof payload["reimagine"] === "string" ? payload["reimagine"].trim() : "";
      const convertTo = payload["convertTo"] === "brief" || payload["convertTo"] === "tags" ? (payload["convertTo"] as PromptFormat) : null;
      if (convertTo) {
        return `Rewrite this Suno style prompt in a different format. Keep every musical detail (genre, tempo, instruments, vocal and where it sits, production, mood); add nothing new and drop nothing.
Input: ${p}
"styleTag" is the current style.
Format: ${styleFieldSpec(convertTo, vTarget)}
Never use real artist, band, producer, label or song names.
Return JSON exactly:
{"styleTag":"the rewritten style"}`;
      }
      if (reimagine) {
        return `Reimagine this song's Suno style as ${reimagine}, like a cover version in a new genre.
Input: ${p}
Fields: "styleTag" is the current style, "excludeStyles" the current exclusions, "vocal" the current vocal character.
Rules:
- ${reimagine} becomes the main genre: put it first, and change the instrumentation, rhythm and production to what that genre uses.
- Keep what makes the song recognisable where it fits the new genre: the mood, the vocal character and gender, and roughly the energy. Adjust the tempo only if the genre needs it.
- ${styleRule(formatOf(payload, "styleTag"), vTarget)}
- Rewrite excludeStyles for the new genre: 3-8 comma-separated traits to keep out (drop any that the new genre needs).
- Never use real artist, band, producer, label or song names.
Return JSON exactly:
{"genre":"short genre label","styleTag":"string","excludeStyles":"string","changes":["one sentence on what changed and what was kept"]}
Return 1-3 changes.`;
      }
      return `Refine this Suno style tag according to the user's instruction. Keep everything not explicitly asked to change; make targeted edits only.
Input: ${p}
Fields: "styleTag" is the current tag. "instruction" is what the user wants changed.
Rules:
- ${styleRule(formatOf(payload, "styleTag"), vTarget)} Keep the format the current style uses.
- Translate requests into production terms — never use real artist, band, producer, label or song names.
- If a request is ambiguous (e.g. "more chill"), pick the most natural interpretation and explain it in changes.
- Limit edits: change or add at most 4 tag elements (or brief phrases) per call; preserve the rest verbatim.
- If the instruction is already reflected in the tag, say so in changes and return the tag unchanged.
Return JSON exactly:
{"styleTag":"the revised style, max ${vTarget} chars","changes":["one sentence describing what was changed and why"]}
Return 1–3 changes. No more.`;
    }
    case "masterSuggest": {
      const PRESET_NAMES = [
        "Flat",
        "Suno v6 starter",
        "Suno rumble fix",
        "Suno sub tame",
        "Suno deep clean",
        "Streaming ready",
        "Tighter low end",
        "Warm & fat",
        "Club sub boost",
        "Clean up boxy mix",
      ];
      const intent = (payload["intent"] as string | undefined)?.trim();
      const stem = typeof payload["stem"] === "string" ? payload["stem"] : "mix";
      const STEM_PRESETS: Record<string, string> = {
        vocals: "Vocal stem: clear & present",
        bass: "Bass stem: tight & solid",
        drums: "Drum stem: punch",
        other: "Instrument stem: make room",
      };
      const stemPreset = STEM_PRESETS[stem];
      if (stemPreset) PRESET_NAMES.splice(0, PRESET_NAMES.length, "Flat", stemPreset);
      const stemNote = stemPreset
        ? `\nIMPORTANT: this file is a single ${stem === "other" ? "instrument" : stem} stem, not a full song. Choose ONLY "Flat" or "${stemPreset}" and judge the balance for that one instrument: a vocal or instrument stem naturally has little sub and bass energy, so never boost it; a bass stem is naturally bass-heavy, so only treat it if it is boomy or rumbling. The preset descriptions below are for full songs; ignore them except for parameter meanings.`
        : "";
      return `You are a mastering engineer advising on bass-focused treatment for a finished track or AI-generated song.${stemNote}
Given the track's offline frequency analysis, recommend a starting preset and any parameter adjustments.${intent ? `\nUser's stated goal: "${intent}" — weight your recommendation toward serving this.` : ""}
Input: ${p}
The "analysis" field contains:
- peakDb / rmsDb: overall level in dBFS
- dynamicRangeDb: crest factor (peakDb − rmsDb); typical music is 6–20 dB
- lowPeakHz: the most energetic sub-frequency in Hz (probe bands: 28, 50, 70, 90, 120, 165, 210 Hz)
- bands: energy of each frequency range in dB relative to the track's full-range RMS
    sub 20–80 Hz | bass 80–250 Hz | lowMid 250–500 Hz | mid 500–2 000 Hz | highMid 2 000–8 000 Hz | air 8 000–20 000 Hz
    0 dB = matches average energy; negative = quieter than average; positive = louder
- analyzedSeconds: seconds analyzed

Available presets (use the exact string):
${PRESET_NAMES.map((n) => `"${n}"`).join(", ")}

Preset purposes:
- "Flat" — no processing; use when the track is already balanced
- "Suno v6 starter" — Band tighten 50% at 120 Hz, mono bass, −2 dB low-mid cut, NO air boost; matches Suno v6's typical heavy lows and dull/noisy top. Good default when nothing stands out.
- "Suno rumble fix" — Dedicated sub compressor (70%) below 50 Hz + sub scoop at 32 Hz; targets vibrating/rumbling sub-40 Hz bass without affecting punch. START HERE for muddy Suno bass.
- "Suno sub tame" — Band mode + 65% tighten at 100 Hz crossover; suppresses AI-generated sub boom dynamically without cutting
- "Suno deep clean" — Aggressive band tighten (80%) at 110 Hz; for very heavy bass
- "Streaming ready" — Moderate band treatment for Spotify/Apple Music/YouTube
- "Tighter low end" — Addresses boom and mud; good when lowMid is elevated
- "Warm & fat" — Adds saturation harmonics so bass reads on small speakers; for thin-sounding tracks
- "Club sub boost" — Full-range bass shelf boost; for club/EDM needing weight below 80 Hz
- "Clean up boxy mix" — Cuts 250 Hz mud, adds air; for mixes with elevated lowMid and weak air

"adjustments" is a Partial<MasterParams> object with any of these number/boolean fields:
  mode ("full"|"band"), bassGainDb (−12…12 dB), crossoverHz (60…200 Hz),
  punchFreq (35…160 Hz), punchGainDb (−9…9 dB), punchQ (0.5…4),
  warmth (0…1), tighten (0…1), monoBass (bool),
  subCutHz (0…40 Hz — see hard rule below), subCutSlope (1|2), subCutQ (0.5…2),
  subCompAmount (0…1, sub-band compressor intensity), subCompFreq (30…80 Hz, sub compressor crossover),
  subScoopDb (−12…0 dB, narrow cut at rumble freq), subScoopFreq (20…50 Hz), subScoopQ (1…6),
  lowMidCutDb (−6…0 dB), airDb (0…6 dB), glue (0…1), ceilingDb (−3…−0.1 dBFS),
  midDb (−4…4 dB, 800 Hz body), presenceDb (−4…4 dB, 3 kHz vocal clarity),
  deHiss (0…1, hiss and shimmer tamer above 7 kHz: suggest 0.3–0.5 when the air band is noisy or the user mentions hiss, harshness or shimmer)

HARD RULES — never violate these:
1. subCutHz must NEVER exceed 40 — values above 40 permanently remove audible bass fundamentals.
2. For boomy bass (sub or bass band significantly above 0 dB), recommend Band mode + high tighten, NOT a high subCutHz.
2b. If the air band is very low (below about −32 dB), the top end is mostly missing or noise: do NOT add airDb, and say in a warning that a muffled top can't be fixed by mastering.
3. If the sub band (20–80 Hz) is significantly above 0 dB AND lowPeakHz is at or below 50 Hz, strongly prefer "Suno rumble fix" or add subCompAmount (0.5–0.9) and subScoopDb (−2 to −4 dB at lowPeakHz) to target the rumble directly. Mention the sub-40 Hz rumble in your reasoning and warn the user to check on good speakers or headphones.
4. punchFreq in adjustments should be close to lowPeakHz (35–160 Hz range only).
5. Never include makeupDb in adjustments — the exporter controls that.
6. Never include subSolo in adjustments — it is a monitoring toggle only.
7. Only include fields in adjustments that genuinely need to differ from the chosen preset.

Return JSON exactly:
{"preset":"one of the preset names above","adjustments":{},"reasoning":"2-3 sentences: the track's main characteristics and why this treatment suits it","warnings":[]}
"warnings" is an array of short strings for genuine concerns (e.g. "Bass is very heavy — check on headphones after export"). Empty array [] if none.`;
    }
    case "song": {
      const measured = payload["measured"] ? `
The input also has "measured": tempo, key, length, a section timeline and tone, measured from the actual audio file in the user's browser.
- Treat the measured BPM as ground truth for the tempo (the true feel may be half or double; pick whichever suits the genre and say which in "tempo"). Put the BPM in the styleTag.
- If the key's confidence is high or medium, include it in the styleTag (e.g. "A minor"); if low, leave it out.
- Use the tone (bass weight, brightness, loudness) to choose production words, and the section energies to judge dynamics and arrangement.
- In "reconciliation", briefly say which details came from the measurements and which from your knowledge or the listener's description.` : "";
      const described = typeof payload["description"] === "string" && payload["description"].trim() ? `
The input has "description": the listener's own words about genre, instruments and vocals. Measurements can't hear those, so rely on the description for them.` : "";
      const noTitle = !(typeof payload["title"] === "string" && payload["title"].trim()) ? `
There is no song title: you don't know this recording. Build the style only from "description" and "measured", and set confidence to "medium" at most (say in the note that it comes from the measurements and description).` : "";
      return `Analyse the production style of ONE specific song for AI music generation (Suno-style).
Input: ${p}
The input has "title" (song name) and "artist" (performer), plus optional "reference" data from MusicBrainz if the recording was found.${measured}${described}${noTitle}
Focus on THIS SPECIFIC RECORDING's production style, not the artist's whole catalog — songs within a catalog often sound very different.
If MusicBrainz status is "not_found" or "unavailable", lower your confidence and note that the style is inferred from training data.
Assess your own real familiarity with this specific recording honestly.
Return JSON exactly:
{"confidence":{"level":"high"|"medium"|"low","note":"one sentence, e.g. Confident — well-known recording"},
"genre":"string","tempo":"string with BPM range and feel","instrumentation":"string",
"vocals":"one-sentence summary of the vocal sound","mood":"string",
"styleTag":"${styleFieldSpec("tags", STYLE_TARGET)}",
"styleBrief":"the SAME sound as styleTag, written as ${styleFieldSpec("brief", STYLE_TARGET)} Same genre, tempo, instruments and vocal as styleTag; only the format differs.",
"vocalPrompt":{"voice":"timbre and range","delivery":"phrasing and performance","harmonies":"backing-vocal treatment, or 'none'","effects":"vocal processing"},
"excludeStyles":"3-8 comma-separated traits to keep OUT of this sound",
"reconciliation":"2-3 sentences describing the specific sonic character of this recording and what makes it distinctive from the artist's typical sound (if applicable). May name the song title and artist here only.",
"recommendedSliders":{"energy":0-100,"complexity":0-100,"brightness":0-100},
"sliderNotes":"one sentence on why those values suit this recording"}
HARD RULE: every field except "reconciliation" must contain NO artist, band, producer, label or song names. Translate each influence into sonic description.\n${VOCAL_PLACEMENT_RULE}`;
    }
    default:
      throw new Error("Unknown task");
  }
}

/** Asks for replacements of specific lines that contain worn-out phrases. */
export function clicheFixPrompt(
  hits: ClicheHit[],
  context: { theme?: string; styleTag?: string },
): string {
  return `Rewrite ONLY the listed lyric lines. Each contains a worn-out phrase.
Replace the image with something concrete and specific, keep the syllable count and rhythm close, and stay coherent with the song.
Song subject: ${context.theme ?? ""}
Style: ${context.styleTag ?? ""}
Lines to rewrite: ${JSON.stringify(hits.map((h) => ({ si: h.si, li: h.li, line: h.line, banned: h.phrase })))}
Return JSON exactly: {"rewrites":[{"si":0,"li":1,"line":"new line"}]}`;
}

/**
 * Second pass for lyrics written by a lighter model (Gemini Flash on free keys): an editor
 * checks the draft against the brief and the craft rules, then returns the improved song in
 * the same JSON shape. Write-then-revise lifts a fast model's output noticeably.
 */
export function polishPrompt(payload: Record<string, unknown>, draft: Record<string, unknown>): string {
  const brief = JSON.stringify(payload).slice(0, 12_000);
  const song = JSON.stringify({ title: draft["title"], sections: draft["sections"] }).slice(0, 12_000);
  return `You are a demanding professional song editor. Improve this draft lyric so it is ready to record.
Brief: ${brief}
Draft: ${song}
Check every line against this list, silently, then fix only what fails. Keep what already works.
- The chorus hook lands in its first 5 words, repeats at least twice in the chorus, and a stranger could sing it back after two listens.
- Concrete images and specific nouns; no worn-out phrases (no "fire in my soul", "shattered heart", "dancing in the rain", "neon lights" filler).
- Lines that sit in the same position in matching sections have similar syllable counts, so they fit the same melody.
- One consistent point of view and tense; every verse adds something new instead of repeating the first.
- Stress falls naturally when sung; no tongue-twisters or padding words added just to rhyme.${lyricStyleRules(payload["rhymeStyle"], payload["voice"])}
- Keep exactly the same sections, in the same order, with the same number of lines in each, the same tags and cues. Change words, not structure.
- Never use banned words from the brief, and never name real artists.
Return JSON exactly, the complete improved song:
{"title":"string, max 60 characters","sections":[{"tag":"[Verse 1]","cue":"optional short direction","lines":["line","line"]}]}`;
}
