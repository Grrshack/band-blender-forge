-- Lab Picks: prompts the admin generates, reviews and schedules for a Monday or Friday drop.
-- Run once in the database SQL editor. Safe to run again.

-- 1. Two new fields on the community library.
ALTER TABLE public.public_prompts ADD COLUMN IF NOT EXISTS lab_pick BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.public_prompts ADD COLUMN IF NOT EXISTS drop_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS public_prompts_lab_idx
  ON public.public_prompts (lab_pick, drop_at DESC);

-- 2. A scheduled pick stays hidden until its drop time (the admin can always see it).
DROP POLICY IF EXISTS "Anyone can read public prompts" ON public.public_prompts;
CREATE POLICY "Anyone can read public prompts"
  ON public.public_prompts FOR SELECT
  USING (drop_at IS NULL OR drop_at <= now() OR public.is_feedback_admin());

-- 3. Only the admin can add Lab Picks or schedule a drop. Everyone else submits as before.
DROP POLICY IF EXISTS "Authenticated users can submit prompts" ON public.public_prompts;
CREATE POLICY "Authenticated users can submit prompts"
  ON public.public_prompts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND ((lab_pick = false AND drop_at IS NULL) OR public.is_feedback_admin())
  );

-- 4. "Top 5 this week": the prompts with the most upvotes in the last 7 days.
--    Counts only; it never reveals who voted.
CREATE OR REPLACE FUNCTION public.weekly_top_prompts(how_many INT DEFAULT 5)
RETURNS TABLE (prompt_id UUID, votes BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.prompt_id, count(*) AS votes
  FROM public.prompt_upvotes u
  JOIN public.public_prompts p ON p.id = u.prompt_id
  WHERE u.created_at >= now() - interval '7 days'
    AND (p.drop_at IS NULL OR p.drop_at <= now())
  GROUP BY u.prompt_id
  ORDER BY votes DESC, max(u.created_at) DESC
  LIMIT least(greatest(how_many, 1), 10);
$$;
REVOKE ALL ON FUNCTION public.weekly_top_prompts(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_top_prompts(INT) TO anon, authenticated;
