# Band Blender: Send to Suno (browser extension)

Version 1.1. Adds **Send to Suno** (and **Send to Gemini / ElevenLabs**) to Band Blender's Export
Sheet, and a live check on Suno's Create page.

## What it does

- **Send and fill.** Press Send in the Export Sheet. Suno's Create page opens with a small panel;
  press **Fill Suno's boxes** and the title, style, exclude list and lyrics go in. Gemini and
  ElevenLabs Music get the same panel for their prompt box.
- **Live check on suno.com.** A small "Band Blender" badge (bottom left) checks the Style, Exclude
  and Lyrics boxes as you type: Suno's 1,000 / 1,000 / 5,000 character limits, artist names,
  contradictions, soft vocals with no placement, and a clean ending. Fixes change a box only when
  you press **Fix**. Turn it off from the badge or in the extension's Options.

## What it doesn't do

- Runs only on Band Blender, suno.com, gemini.google.com and elevenlabs.io.
- Never presses Create or Send, never reads your songs, library or account, and sends nothing to
  any server. What you sent is kept in the browser for 2 hours, then ignored.
- Suno's terms ban robots, scraping and data mining. This does none of those: it reads and types
  into boxes on your screen, on your click.

## Files

- `manifest.json`, `bridge.js` (Band Blender page), `suno.js`, `engines.js`, `options.html/js`.
- `live.js` is generated from `src/lib` (the same pre-flight checks the Export Sheet runs):
  `node scripts/build-extension.mjs`. Don't edit it by hand.

## Install for testing (Chrome, Edge, Brave)

1. Unzip `band-blender-extension.zip`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Press **Load unpacked** and pick the unzipped folder.
4. Reload Band Blender.

## Store builds

For the Chrome Web Store, remove the `localhost` and `127.0.0.1` entries from `manifest.json`,
then zip the folder's contents (manifest.json at the top level, no README needed). Raise
`version` for every upload.
