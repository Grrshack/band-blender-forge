# Band Blender: Send to Suno (browser extension)

Version 1.1. Adds **Send to Suno** (and **Send to Gemini / ElevenLabs**) to Band Blender's Export
Sheet, and a live check on Suno's Create page.

## What it does

- **Send and fill.** Press Send to Suno on the Suno Sheet, Lyric Forge or Band Blender. Suno's
  Create page opens with a small panel; press **Fill Suno** and the title, style, exclude list and
  lyrics go in. Gemini and ElevenLabs Music get the same panel for their prompt box.
- **1.1 Fill panel.** Pick which take to fill (Main, Darker, Bigger drop…), untick anything to leave
  as it is in Suno, and **Undo** puts the boxes back. It also sets Instrumental (on when the song has
  sections but no sung lines), vocal gender and the Weirdness / Style Influence sliders, opening
  "More options" when it has to. Anything it can't find or set is named: "Couldn't find …" /
  "Please check …". **Report a problem** copies which of Suno's controls were found (no song text).
- **Reuses your Suno tab (1.1).** Send to Suno switches to a Suno Create tab you already have open
  instead of opening another (background.js; Suno tabs say hello, only their tab ids are kept for
  the browser session). A Suno tab on another page is left alone. Works with Suno's July 2026
  lyrics editor too (found by its "Lyrics" label, filled the way a paste arrives if typing is refused).
- **Toolbar button.** Shows whether a song is waiting, with Open Suno, Open Band Blender, the guide
  and Settings. No extra permissions.
- **Live check on suno.com.** A small "Band Blender" badge (bottom left) checks the Style, Exclude
  and Lyrics boxes as you type: Suno's 1,000 / 1,000 / 5,000 character limits, artist names,
  contradictions, soft vocals with no placement, and a clean ending. Fixes change a box only when
  you press **Fix**. Turn it off from the badge or in the extension's Options.

## What it doesn't do

- Runs only on Band Blender, suno.com, gemini.google.com and elevenlabs.io.
- Never presses Create or Send, never reads your songs, library or account, and sends nothing to
  any server. What you sent is deleted from the browser's extension storage once you press Fill or
  dismiss the panel, and anything older than 2 hours is deleted the next time Suno or the toolbar
  button opens.
- Suno's terms ban robots, scraping and data mining. This does none of those: it reads and types
  into boxes on your screen, on your click.

## Files

- `manifest.json`, `bridge.js` (Band Blender page), `suno.js`, `engines.js`, `options.html/js`,
  `popup.html/js` (toolbar button), `background.js` (switches to an open Suno tab).
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
