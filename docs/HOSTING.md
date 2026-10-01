# Moving off Lovable hosting

A plan for hosting the app yourself. Sources: Lovable's "Deploying and hosting outside Lovable" and
"Deployment, hosting, and ownership options" pages, and Vercel's "Deploy a Lovable app" page. Those
pages are a few months old and dashboards change, so if a button is named differently, look for the
closest match.

## What you have

| Part                          | Where it lives today                     |
| ----------------------------- | ---------------------------------------- |
| The website + its server code | Your GitHub repo, published by Lovable   |
| Database + sign-in            | Lovable Cloud (Supabase under the hood)  |
| The built-in AI               | Lovable's AI gateway (`LOVABLE_API_KEY`) |

The app is a **TanStack Start** app, which **runs server code**. A plain file host (like GitHub Pages)
will not work; you need a host that runs a server: **Vercel, Netlify or Cloudflare**.

## The safe way: two stages

**Stage 1 (do this first): move only the website.** The database and sign-in stay on Lovable Cloud.
This is the easy, low-risk part.

**Stage 2 (only if you ever need it): move the database too.** This is the risky part. Skip it until
there is a real reason.

## Stage 1 — host on Vercel (about 20 minutes)

Vercel detects Lovable/TanStack Start projects automatically, and every push to GitHub redeploys.

1. Make a free account at vercel.com and sign in **with GitHub**.
2. **Add New → Project**, pick your `band-blender-forge` repo, click **Import**.
3. Vercel should detect the framework on its own. **Before clicking Deploy**, open **Environment
   Variables** and add these:

   | Name                                               | Value                                  | Needed?                               |
   | -------------------------------------------------- | -------------------------------------- | ------------------------------------- |
   | `SUPABASE_URL`                                     | copy from the `.env` file in your repo | yes                                   |
   | `SUPABASE_PUBLISHABLE_KEY`                         | copy from `.env`                       | yes                                   |
   | `VITE_SUPABASE_URL`                                | copy from `.env`                       | yes                                   |
   | `VITE_SUPABASE_PUBLISHABLE_KEY`                    | copy from `.env`                       | yes                                   |
   | `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | copy from `.env`                       | yes                                   |
   | `ANTHROPIC_API_KEY`                                | a key from console.anthropic.com       | **yes, if you want a built-in model** |
   | `MUSICBRAINZ_CONTACT`                              | your email                             | optional                              |

   The Supabase values are "publishable" keys meant for browsers, so they are fine to copy. **Never
   put a secret key in the repo.** `ANTHROPIC_API_KEY` goes only in Vercel's settings.

4. Click **Deploy**, open the address it gives you, and test (see the checklist below).

### Why `ANTHROPIC_API_KEY` matters

The "built-in model" today uses Lovable's gateway key, which will not exist on Vercel. Without
`ANTHROPIC_API_KEY`, people who haven't pasted their own key get a "no built-in AI" error. With it:

- the site owner (you) pays for built-in calls;
- the app **already requires sign-in** and allows **120 built-in calls per hour per person**;
- people who paste their own key are never limited and never cost you anything.

Set a monthly spending limit in the Anthropic console before you publish the address.

### Sign-in after the move

Sign-in links and redirects are tied to the site address. If login breaks on the new address, the
backend's allowed redirect URLs need your new address added. Look in **More → Cloud** for the auth
or URL settings. If you can't find them, ask Lovable's chat:
_"Add https://YOUR-SITE.vercel.app as an allowed redirect URL for sign-in."_

## Stage 2 — moving the database (later, optional)

Lovable documents an export: **More → Cloud → Overview → Advanced settings → Export project data →
Database → Export**. You get an email when it's ready, and the file lands in **More → Cloud →
Storage**. Importing it into your own Supabase project, recreating the sign-in settings and pointing
the `SUPABASE_*` variables at it is a separate job. Lovable's pages don't spell out how users'
logins move, so **treat accounts as something to test, not assume.** Do this only with a backup and
no rush.

## Checklist before you tell anyone the address

- [ ] The live site opens and all tabs show.
- [ ] Signed out, with no key: generating shows "Sign in to use the built-in model…" (intended).
- [ ] Signed in, key box empty: a blend works, and a row appears in the `ai_usage` table.
- [ ] Signed in with your own key pasted: works, and adds **no** `ai_usage` row.
- [ ] Sign-in works on the new address (see "Sign-in after the move").
- [ ] A monthly spending limit is set on your Anthropic account.
- [ ] You decided whether the GitHub repo should be private (Vercel can deploy private repos).
- [ ] Keep the old Lovable published site running until the new one has passed all of the above.

## What I could not verify

- Exact button names in Vercel, Lovable Cloud and Anthropic's console.
- Whether your Lovable project's auth settings need changes beyond the redirect URLs.
- How user accounts behave in a Stage 2 move.
