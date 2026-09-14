# Band Blender Forge

Build a web application called "Band Lookup & Lyric Forge". It is a highly optimized pre-production planning tool for AI music generation. Give the application a sleek, dark, cyberpunk studio aesthetic using dark grays, deep obsidian, neon violet, and electric teal as visual accents. 

Create a split-screen or multi-tab responsive interface with the following 4 core modules:

1. BAND LOOKUP & BLENDER:

- Include an input layout allowing users to type in 1, 2, or 3 musical artists or bands to blend.

- Underneath, show a "Confidence Check" status indicator (e.g., Green = "High artist familiarity", Yellow = "Model confidence low, proceeding with caution").

- Generate an output section that displays a coherent style breakdown: Genre, Tempo (BPM), Instrumentation, Vocals, Mood, and a perfectly ordered, ready-to-copy "Suno Style Tag Prompt".

- Add an explicit text box labeled "Blend Reconciliation Logic" that explains exactly how the conflicting styles of the chosen artists are being fused (e.g., blending a clean vocal artist with a metal scream artist).

- Include slider bars for genre-appropriate recommendations (e.g., Energy, Complexity, Brightness).

2. LYRIC FORGE:

- A lyric generation workspace that explicitly avoids generic AI clichés and focuses heavily on hook catchiness and rhythm over simple rhyming.

- Output text boxes divided clearly into standard section tags: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], etc.

- Critical Feature: Next to EACH individual lyric line, include small inline utility buttons: a "Lock" toggle icon and a "Regenerate Line" circular arrow icon. Next to each major section header, add a "Regenerate Section" button to allow granular editing instead of all-or-nothing generation.

3. FIND COMPARABLE ARTISTS:

- A reverse-lookup tool where users can paste their own lyrics or a string of style tags.

- The output should display a clean list of 3-4 real-world artists that match the tone, along with a bulleted "Reasoning" breakdown explaining why the AI sees the artistic connection.

4. SYSTEM ARCHITECTURE & CREDENTIALS PANEL:

- A small, collapsible settings panel at the bottom or corner of the screen.

- Include a text field for "Anthropic API Key" (stored locally in the browser/session state) and a toggle switch for "Model Routing Type" (Option A: "Fast & Economic Lookup" using Haiku, Option B: "Creative Writing Craft" using Sonnet).

- State clearly that the application holds zero persistent state, operates purely on client-side or serverless function runtime, and saves no user data to a database.

Ensure all text boxes have a prominent, functional "Copy to Clipboard" button. Make all UI tabs snappy, modern, and highly responsive.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bec9cf82-40c7-471c-afdc-82075b1ef942).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
