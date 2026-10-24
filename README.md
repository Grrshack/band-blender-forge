# Band Blender

A free web app that helps people get better songs out of Suno. It writes and checks style
prompts and lyrics before you generate, then helps fix, master and release what Suno made.

Live at [suno-blender.lovable.app](https://suno-blender.lovable.app). Not affiliated with Suno.

## What it does

- **Band Blender**: blend up to three artists, or one song, into a Suno v6 style prompt and
  Exclude styles. Includes Style Chat, Reimagine (same song, new genre), style variants and a
  "How did it come out?" take check.
- **Analyze a Song**: measures tempo, key, sections and tone in the browser, then builds a prompt
  in that style.
- **Lyric Forge**: hook-first lyrics in Suno section tags, with rhyme and voice controls, rhyme
  scheme view, "Loosen rhymes", a length planner, and cliché, banned-word and pronunciation checks.
- **Export Sheet**: everything ready to paste into Suno, plus Gemini / Flow Music and ElevenLabs.
- **Fix a Track**: says whether to edit in Suno, regenerate or just master, with edit
  instructions and timestamps.
- **Mastering**: browser mastering for songs and stems, with a can/can't-fix verdict, reference
  matching and WAV or MP3 export.
- **Release Kit**: cover-art prompt, metadata, social copy and a release checklist.
- **Free tools at `/tools`** (no AI key): BPM & key finder, lyric checker, metatag reference,
  release checklist.

## How it works

- **AI runs on the user's own key** (a free Google Gemini key or an Anthropic key). The key stays
  in the browser and passes through the server only to make each request.
- **Audio never leaves the browser.** Analysis, mastering and tempo detection run on the device.
- **No account needed.** Songs and saved sounds are kept in the browser; signing in adds cloud
  sync and community sharing.
- **Feedback and anonymous usage stats** go to Supabase tables that only listed admins can read
  (see `/admin/feedback`).

## Stack

TanStack Start (React, Vite, file routes and server functions), Tailwind CSS, shadcn/ui, and
Supabase through Lovable Cloud. Built and published with [Lovable](https://lovable.dev).

## Project layout

| Folder | What's in it |
| --- | --- |
| `src/routes` | Pages: landing (`index.tsx`), `studio.tsx`, `/tools/*`, `/guides/*`, `/admin/feedback`, auth |
| `src/components/forge` | Studio screens and their parts |
| `src/components/tools` | Shared layout for the free tool pages |
| `src/lib` | Logic: AI tasks and prompts (`forge.*`), rhyme and lyric checks, saving, guides, stats |
| `src/lib/audio` | In-browser audio: analysis, tempo, mastering chain, WAV and MP3 export |
| `supabase/migrations` | Database SQL, run by hand in Lovable's SQL panel, in date order |
| `src/__tests__` | Unit tests (Vitest) |

The app name lives only in `src/lib/brand.ts`. `src/routeTree.gen.ts` is generated; don't edit it.

## Running it locally

```bash
npm install
npm run dev      # development server
npm test         # unit tests
npm run build    # production build
```

Supabase settings come from Lovable Cloud. Leave `ALLOW_BUILT_IN_AI` unset to keep own-key mode;
only the exact value `true` lets the app use the owner's AI keys.

## Making changes

Changes are usually applied in Lovable and published from there. Database changes are SQL files
in `supabase/migrations`, run in Lovable's SQL panel. If you also edit the code elsewhere (GitHub,
Bolt), export the latest version first so tools don't overwrite each other.
