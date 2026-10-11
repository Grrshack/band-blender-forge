import { bannedWordsInstruction } from "@/lib/banned-words";
import { bannedListForPrompt, type ClicheHit } from "@/lib/cliches";
import { STYLE_TARGET, STYLE_TARGET_FOR_VERSION, type SunoVersion } from "@/lib/suno";

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

function promptBody(task: string, payload: Record<string, unknown>): string {
  const p = JSON.stringify(payload);
  switch (task) {
    case "blend": {
      const rawVersion = payload["sunoVersion"];
      const version: SunoVersion =
        rawVersion === "mini" || rawVersion === "pro" ? rawVersion : "v6";
      const vTarget = STYLE_TARGET_FOR_VERSION[version];
      const vLabel =
        version === "mini" ? "Suno v6 Mini" : version === "pro" ? "Suno v6 Pro" : "Suno v6";
      const vNote =
        version === "mini"
          ? "Keep the style tag concise and punchy — Mini responds better to short, direct prompts than long tag lists."
          : version === "pro"
            ? "Pro handles rich detail — use flowing descriptive phrases mixed with genre tags, and use the full character budget where it adds specificity."
            : "v6 understands natural language well — mix descriptive phrases with genre tags rather than tag-only lists.";
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
"styleTag":"a single comma-separated Suno style prompt line, ordered: genre, subgenre, tempo/bpm, instrumentation, vocal type, production, mood. Front-load genre and mood. Max ${vTarget} characters.",
"voiceTags":"Suno v6 bracket vocal tags to prepend to the lyrics field, e.g. '[Female Vocal]' or '[Male Vocal], [Whisper]'. Choose from: [Male Vocal] [Female Vocal] [Duet] [Choir] [Rap] [Whisper] [Falsetto] [Raw Vocals]. Max 2-3 tags. Empty string if not applicable.",
"vocalPrompt":{"voice":"timbre and range, e.g. warm breathy alto","delivery":"phrasing and performance, e.g. close-mic, half-spoken verses, belted chorus","harmonies":"backing-vocal treatment, or 'none'","effects":"vocal processing, e.g. tape echo, light pitch correction"},
"excludeStyles":"3-8 comma-separated traits to keep OUT of this sound (for Suno's Exclude styles box), e.g. 'autotune, trap hi-hats, EDM drop'",
"contradictions":"array of 0-3 short strings flagging any terms in the styleTag that may conflict with each other and confuse Suno v6 (e.g. 'acoustic and heavy bass may conflict'). Empty array [] if none found.",
"reconciliation":"2-4 sentences explaining exactly how conflicting elements of the chosen artists are fused, naming the specific conflicts and the resolution",
"recommendedSliders":{"energy":0-100,"complexity":0-100,"brightness":0-100},
"sliderNotes":"one sentence on why those values suit this blend"}
HARD RULE: every field except "reconciliation" must contain NO artist, band, producer, label or song names — not the input artists, not any other. Translate each influence into sonic description.`;
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
      return `Write song lyrics for this brief.
Input: ${p}
Rules: hooks must be rhythmically repeatable and easy to sing; concrete images and specific nouns only;
avoid banned crutch phrases; vary line lengths; the chorus hook must land in its first 5 words.
Hook-craft rules (apply to every chorus):
- Favour open vowel sounds (ah, oh, ay, ee) on the syllable that lands on the strongest beat — these project further and read as catchier.
- The chorus hook phrase must repeat at least twice within the chorus itself.
- Apply the stranger test: would a stranger who heard this twice be able to sing back the hook? If not, simplify it.${avoidNote}${tagsNote}
If "structure" is present in the input it is a plan: produce EXACTLY those sections, in that order, with exactly that many lyric lines in each (instrumental sections get "lines":[]). Do not add or drop sections.
Suno reads bracketed performance cues, so use them with purpose, not on every section:
- "cue" is an optional 1-4 word delivery direction for that section, e.g. "Whispered, sparse" or "Belted, full band".
- Include at most two instrumental sections (e.g. [Guitar Solo], [Instrumental Break]) with "lines":[] when the song needs one.
- Put ad-libs in parentheses inside a line only where they strengthen the hook, e.g. "(hey!)".
- Match cues to the linked style's vocal prompt; never put genre or instrument descriptions inside lyric lines.
Return JSON exactly:
{"title":"string, max 60 characters","sections":[{"tag":"[Verse 1]","cue":"optional short direction","lines":["line","line"]}]}
Use standard tags: [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Bridge] [Outro] as appropriate.`;
    }
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
      return `Rewrite ONE lyric line inside an existing song, keeping syllable count and rhythm close, keeping meaning coherent with neighbours, and avoiding clichés.
Input: ${p}
Return JSON exactly: {"line":"the new line"}`;
    case "regenSection":
      return `Rewrite ONE section of an existing song. Keep locked lines EXACTLY as given (they are marked locked).
Input: ${p}
Return JSON exactly: {"tag":"[Chorus]","lines":["line","line"]}
Return the same number of lines, in order, with locked lines unchanged.`;
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
      return `You are a Suno prompt doctor. The user generated a take that came out wrong. Diagnose the PROMPT-side causes and revise the style prompt.
Input: ${p}
Rules:
- Change only what the complaints justify; keep everything else identical so the next take isolates the fix. Change at most 3 things.
- If "history" is present it lists earlier takes (oldest first) with 1-5 star ratings and notes. Use it: never repeat a change that coincided with a low rating, and keep what scored well.
- Be honest: Suno is stochastic and some problems (e.g. a voice that sounds synthetic) cannot be fully fixed by prompting. Say so in the diagnosis when it applies.
- Common prompt-side causes: contradictory tags, too many tags diluting each other, genre words buried late, negatives written inside the style box instead of Exclude styles, conflicting tempo or energy words, instrument lists that crowd the mix.
- styleTag: the full revised style prompt, max ${STYLE_TARGET} characters, genre and mood first, NO real artist, band, producer, label or song names.
- excludeStyles: the full revised comma-separated exclude list, no artist names.
- lyricFixes: only if the complaints or lyrics justify it; quote the exact original line or section tag.
Return JSON exactly:
{"diagnosis":"2-3 plain sentences naming the most likely prompt-side causes",
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
Rules: differences must be audible, not cosmetic — do not just reorder tags. Each styleTag is one comma-separated line, genre and mood first, max ${STYLE_TARGET} characters. NO real artist, band, producer, label or song names anywhere. Each excludeStyles is 3-8 comma-separated traits.
Return JSON exactly:
{"variants":[{"label":"Safe","angle":"one sentence: what is different about this take","styleTag":"string","excludeStyles":"string","vocalLine":"one short line describing the vocal"},{"label":"Experimental","angle":"","styleTag":"","excludeStyles":"","vocalLine":""},{"label":"Hybrid","angle":"","styleTag":"","excludeStyles":"","vocalLine":""}]}`;
    case "refine": {
      const rawVersion = payload["sunoVersion"];
      const version: SunoVersion =
        rawVersion === "mini" || rawVersion === "pro" ? rawVersion : "v6";
      const vTarget = STYLE_TARGET_FOR_VERSION[version];
      return `Refine this Suno style tag according to the user's instruction. Keep everything not explicitly asked to change; make targeted edits only.
Input: ${p}
Fields: "styleTag" is the current tag. "instruction" is what the user wants changed.
Rules:
- Output a single comma-separated style tag line, genre and mood first, max ${vTarget} characters.
- Translate requests into production terms — never use real artist, band, producer, label or song names.
- If a request is ambiguous (e.g. "more chill"), pick the most natural interpretation and explain it in changes.
- Limit edits: change or add at most 4 tag elements per call; preserve the rest verbatim.
- If the instruction is already reflected in the tag, say so in changes and return the tag unchanged.
Return JSON exactly:
{"styleTag":"revised comma-separated style tag, max ${vTarget} chars","changes":["one sentence describing what was changed and why"]}
Return 1–3 changes. No more.`;
    }
    case "masterSuggest": {
      const PRESET_NAMES = [
        "Flat",
        "Suno sub tame",
        "Suno deep clean",
        "Streaming ready",
        "Tighter low end",
        "Warm & fat",
        "Club sub boost",
        "Clean up boxy mix",
      ];
      return `You are a mastering engineer advising on bass-focused treatment for a finished track or AI-generated song.
Given the track's offline frequency analysis, recommend a starting preset and any parameter adjustments.
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
  lowMidCutDb (−6…0 dB), airDb (0…6 dB), glue (0…1), ceilingDb (−3…−0.1 dBFS)

HARD RULES — never violate these:
1. subCutHz must NEVER exceed 40 — values above 40 permanently remove audible bass fundamentals.
2. For boomy bass (sub or bass band significantly above 0 dB), recommend Band mode + high tighten, NOT a high subCutHz.
3. punchFreq in adjustments should be close to lowPeakHz (35–160 Hz range only).
4. Never include makeupDb in adjustments — the exporter controls that.
5. Only include fields in adjustments that genuinely need to differ from the chosen preset.

Return JSON exactly:
{"preset":"one of the preset names above","adjustments":{},"reasoning":"2-3 sentences: the track's main characteristics and why this treatment suits it","warnings":[]}
"warnings" is an array of short strings for genuine concerns (e.g. "Bass is very heavy — check on headphones after export"). Empty array [] if none.`;
    }
    case "song":
      return `Analyse the production style of ONE specific song for AI music generation (Suno-style).
Input: ${p}
The input has "title" (song name) and "artist" (performer), plus optional "reference" data from MusicBrainz if the recording was found.
Focus on THIS SPECIFIC RECORDING's production style, not the artist's whole catalog — songs within a catalog often sound very different.
If MusicBrainz status is "not_found" or "unavailable", lower your confidence and note that the style is inferred from training data.
Assess your own real familiarity with this specific recording honestly.
Return JSON exactly:
{"confidence":{"level":"high"|"medium"|"low","note":"one sentence, e.g. Confident — well-known recording"},
"genre":"string","tempo":"string with BPM range and feel","instrumentation":"string",
"vocals":"one-sentence summary of the vocal sound","mood":"string",
"styleTag":"a single comma-separated Suno style prompt line, ordered: genre, subgenre, tempo/bpm, instrumentation, vocal type, production, mood. Front-load genre and mood. Max ${STYLE_TARGET} characters.",
"vocalPrompt":{"voice":"timbre and range","delivery":"phrasing and performance","harmonies":"backing-vocal treatment, or 'none'","effects":"vocal processing"},
"excludeStyles":"3-8 comma-separated traits to keep OUT of this sound",
"reconciliation":"2-3 sentences describing the specific sonic character of this recording and what makes it distinctive from the artist's typical sound (if applicable). May name the song title and artist here only.",
"recommendedSliders":{"energy":0-100,"complexity":0-100,"brightness":0-100},
"sliderNotes":"one sentence on why those values suit this recording"}
HARD RULE: every field except "reconciliation" must contain NO artist, band, producer, label or song names. Translate each influence into sonic description.`;
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
