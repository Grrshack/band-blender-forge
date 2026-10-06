-- ============================================================
-- Band Blender Forge — feature migrations
-- Run in order in Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================


-- ── 1. Error logging ────────────────────────────────────────
-- Captures failed AI calls for debugging without exposing them publicly.

CREATE TABLE IF NOT EXISTS ai_errors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  task        TEXT        NOT NULL,
  error_message TEXT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_errors ENABLE ROW LEVEL SECURITY;

-- Users can read their own errors; server inserts with service role so no INSERT policy needed for client.
CREATE POLICY "Users read own errors"
  ON ai_errors FOR SELECT
  USING (auth.uid() = user_id);


-- ── 2. Shareable blend links ─────────────────────────────────
-- A blend result with a short public slug; anyone with the link can read it.

CREATE TABLE IF NOT EXISTS public_blends (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,          -- e.g. "portishead-massive-fka-a3f9"
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  artists     TEXT[]      NOT NULL DEFAULT '{}',
  blend_data  JSONB       NOT NULL,                 -- full BlendResult JSON
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_blends ENABLE ROW LEVEL SECURITY;

-- Anyone can read a public blend (no auth required).
CREATE POLICY "Public blends are readable by anyone"
  ON public_blends FOR SELECT
  USING (true);

-- Only authenticated users can create blends.
CREATE POLICY "Authenticated users can share blends"
  ON public_blends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shared blends.
CREATE POLICY "Users can delete own blends"
  ON public_blends FOR DELETE
  USING (auth.uid() = user_id);


-- ── 3. Public prompt library ─────────────────────────────────
-- Crowd-sourced style prompts users can submit and upvote.

CREATE TABLE IF NOT EXISTS public_prompts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  style_tag    TEXT        NOT NULL,
  vocal_prompt JSONB,
  exclude_styles TEXT,
  artists      TEXT[]      DEFAULT '{}',
  genre_tags   TEXT[]      DEFAULT '{}',
  upvotes      INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public prompts"
  ON public_prompts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can submit prompts"
  ON public_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
  ON public_prompts FOR DELETE
  USING (auth.uid() = user_id);

-- Upvotes: one per user per prompt.
CREATE TABLE IF NOT EXISTS prompt_upvotes (
  user_id    UUID REFERENCES auth.users(id)    ON DELETE CASCADE,
  prompt_id  UUID REFERENCES public_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

ALTER TABLE prompt_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own upvotes"
  ON prompt_upvotes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep upvote count in sync automatically.
CREATE OR REPLACE FUNCTION increment_upvote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public_prompts SET upvotes = upvotes + 1 WHERE id = NEW.prompt_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_upvote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public_prompts SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.prompt_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_upvote_insert
  AFTER INSERT ON prompt_upvotes
  FOR EACH ROW EXECUTE FUNCTION increment_upvote();

CREATE TRIGGER on_upvote_delete
  AFTER DELETE ON prompt_upvotes
  FOR EACH ROW EXECUTE FUNCTION decrement_upvote();


-- ── 4. Cost / usage visibility ───────────────────────────────
-- The ai_usage table already exists. These views make it easy to
-- query usage in the Supabase dashboard or from the app.

CREATE OR REPLACE VIEW usage_by_day AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
  task,
  COUNT(*)                                          AS calls
FROM ai_usage
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

CREATE OR REPLACE VIEW usage_by_user AS
SELECT
  user_id,
  COUNT(*)                            AS total_calls,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS calls_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')   AS calls_7d,
  MAX(created_at)                     AS last_call
FROM ai_usage
GROUP BY user_id
ORDER BY total_calls DESC;

-- Quick check: run this to see your own today's usage
-- SELECT * FROM usage_by_day WHERE day >= NOW() - INTERVAL '7 days';
