# Band Blender: Send to Suno (browser extension)

Adds a "Send to Suno" button to Band Blender's Export Sheet. Press it, and Suno's Create page opens
with a small Band Blender panel; press **Fill Suno's boxes** and your title, style, exclude list and
lyrics go into Suno. You check them and press Create yourself.

## What it does and doesn't do

- Runs only on Band Blender and on suno.com.
- Fills text boxes when you press Fill. It never presses Create, never reads your songs or account,
  and sends nothing to any server. What you sent is kept in the browser for 2 hours, then ignored.
- Suno's terms ban robots, scraping and data mining. This does none of those: it types into boxes
  you could type into yourself, on your click.
- If Suno changes its page and a box isn't found, the panel says which one and you can use Copy.

## Install for testing (Chrome, Edge, Brave)

1. Unzip `band-blender-extension.zip`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Press **Load unpacked** and pick the unzipped folder.
4. Reload Band Blender. The Export Sheet now shows **Send to Suno**.

## Publishing to the Chrome Web Store

1. Make a Chrome Web Store developer account (one-time $5 fee).
2. Zip this folder (manifest.json at the top level) and upload it as a new item.
3. Use the description above, the 128px icon, and a screenshot of the panel on Suno.
4. Privacy: it stores only what you send, locally, and collects no data.

Firefox would need small manifest changes; not done yet.
