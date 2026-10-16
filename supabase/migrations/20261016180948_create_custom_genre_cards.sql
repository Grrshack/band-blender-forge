/*
# Create custom_genre_cards table

## Purpose
The app's Genre Guide feature lets users save custom genre cards with style
templates, instrumentation, BPM, etc. The TypeScript types and server functions
already reference this table, but it was never created in the database —
causing errors when users try to list, save, or delete custom genre cards.

## New Table
- `custom_genre_cards`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users, cascade on delete)
  - `name` (text, not null) — display name for the card
  - `emoji` (text, not null, default '🎵') — emoji shown in the UI
  - `family` (text, not null, default 'Custom') — genre family grouping
  - `bpm` (text, default '') — BPM range or value
  - `feel` (text, default '') — mood/feel description
  - `instrumentation` (text, default '') — suggested instruments
  - `vocals` (text, default '') — vocal style description
  - `style_template` (text, not null) — the full style prompt template
  - `exclude` (text, default '') — styles to exclude
  - `notes` (text, default '') — user notes
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `custom_genre_cards`.
- Four owner-scoped policies (select/insert/update/delete), each TO authenticated,
  checking auth.uid() = user_id.
- user_id defaults to auth.uid() so inserts from the authenticated client succeed
  even when the client omits user_id.

## Important Notes
1. This table is multi-user (owner-scoped) — only the signed-in owner can CRUD their cards.
2. The `requireSupabaseAuth` middleware in genre.functions.ts enforces auth before any handler runs.
3. Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS so re-running is safe.
*/

CREATE TABLE IF NOT EXISTS custom_genre_cards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  emoji            TEXT        NOT NULL DEFAULT '🎵',
  family           TEXT        NOT NULL DEFAULT 'Custom',
  bpm              TEXT        NOT NULL DEFAULT '',
  feel             TEXT        NOT NULL DEFAULT '',
  instrumentation  TEXT        NOT NULL DEFAULT '',
  vocals           TEXT        NOT NULL DEFAULT '',
  style_template   TEXT        NOT NULL,
  exclude          TEXT        NOT NULL DEFAULT '',
  notes            TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_genre_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_genre_cards" ON custom_genre_cards;
CREATE POLICY "select_own_genre_cards" ON custom_genre_cards FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_genre_cards" ON custom_genre_cards;
CREATE POLICY "insert_own_genre_cards" ON custom_genre_cards FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_genre_cards" ON custom_genre_cards;
CREATE POLICY "update_own_genre_cards" ON custom_genre_cards FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_genre_cards" ON custom_genre_cards;
CREATE POLICY "delete_own_genre_cards" ON custom_genre_cards FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
