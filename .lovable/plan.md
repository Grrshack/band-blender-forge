# Band Lookup & Lyric Forge — Level Up

Three upgrades: a blue-forward look, saved sessions with a real workspace, and a prompt library. Plus an honest-feedback critique module that works from lyrics and notes only (no audio upload, nothing stored).

## 1. Palette shift: blue with a violet edge

Move the accent from neon violet to electric blue, keeping violet as the secondary highlight.

- Base near-black `#0B0D16`, panels `#151327`, primary blue `#3B5BFF`, secondary violet `#A855F7`.
- Blue drives buttons, focus rings, active tabs, and the main glow; violet is reserved for secondary states, meters, and "AI-generated" markers.
- Confidence lamp keeps green/amber/red so status stays readable against the cool base.
- Slight contrast lift on body text and panel borders — current borders are faint against the dark background.

## 2. Session workspace

Right now the three tabs barely know about each other and everything vanishes on refresh.

- A named session ties blend + lyrics + comparables together. Rename, duplicate, delete.
- Sidebar (or top dropdown) listing your sessions with last-edited time.
- Autosave as you work; reopening restores exactly where you left off.
- "Export brief" produces one copy-ready document: style tag, breakdown, reconciliation, full lyrics with section tags, comparable artists.
- Requires sign-in and a backend, so the current zero-storage promise is replaced by a clear statement: your work is yours, private to your account, deletable at any time.

## 3. Prompt library

- Curated starter presets (genre/mood/production shorthands, lyric brief templates, structure templates).
- Save your own presets from any input, with tags and search.
- One-click apply into the Blender or Lyric Forge; one-click copy.
- Presets are per-account; starter presets ship with the app.

## 4. Honest feedback (lyrics + notes)

A fourth tab. You paste lyrics and describe the track (tempo, arrangement, what you're worried about). The model returns blunt, specific critique — no praise padding.

- Scores with short justification: hook strength, imagery, singability, structure, originality.
- Cliché detector flagging exact lines, with concrete rewrite suggestions.
- Prosody/syllable notes on lines that will be awkward to sing.
- "Three things to fix first" ordered list.
- Nothing is uploaded; the critique is saved to the session only if you keep it.

## What else is weak today

- No empty-state guidance — the first screen doesn't teach what a good input looks like. Add example artists and a one-click demo.
- Errors surface as toasts that disappear; failures should stay visible in the panel with a retry.
- Long generations show only a spinner — add staged progress text.
- No history on lyric regeneration: rewriting a line loses the previous version. Add per-line undo.
- No mobile pass on the lyric editor; the per-line buttons crowd on narrow screens.
- Blend sliders currently only reflect the model's recommendation — they should feed back into regeneration when you move them.

## Technical notes

- Enable Lovable Cloud for accounts and storage. Tables: `sessions` (blend JSON, lyrics JSON, comparables JSON, critique JSON), `prompt_presets` (owner, title, body, kind, tags). Row-level security scoped to the owner; starter presets are read-only rows visible to everyone.
- Auth: email/password plus Google sign-in.
- Sessions autosave via debounced server functions; the whole three-tab state serialises to JSON columns.
- Critique reuses the existing `runForge` server function with a new `critique` task and its own strict-JSON prompt.
- Palette change is confined to the token block in `src/styles.css`; components already use semantic tokens, so no per-component color edits.
- Existing session-only Anthropic key handling and model routing stay exactly as they are.

## Build order

1. Palette shift (visible immediately, no backend).
2. Cloud + auth + sessions with autosave and export.
3. Prompt library.
4. Honest feedback tab.
5. Polish pass: empty states, error surfaces, per-line undo, mobile lyric editor.
