-- ============================================================
-- Security + logging fixes (Oct 17 2026). Safe to re-run.
-- ============================================================

-- ── 1. Usage views: stop them bypassing row-level security ──
-- Views run as their owner by default, which skips the RLS on ai_usage.
-- With Supabase's default grants that let anyone holding the public key
-- read every user's id and call counts via /rest/v1/usage_by_user.
-- security_invoker makes the views respect ai_usage's "own rows only" policy.
-- The app itself doesn't read these views (getMyUsage queries ai_usage directly).
ALTER VIEW IF EXISTS public.usage_by_day  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.usage_by_user SET (security_invoker = true);
REVOKE ALL ON public.usage_by_day  FROM anon;
REVOKE ALL ON public.usage_by_user FROM anon;

-- ── 2. Error logging: let signed-in users' calls actually write ──
-- runForge inserts into ai_errors with the signed-in user's client, not the
-- service role, so without an INSERT policy every insert was silently rejected.
DROP POLICY IF EXISTS "Users log their own errors" ON public.ai_errors;
CREATE POLICY "Users log their own errors"
  ON public.ai_errors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Community prompts: new submissions always start at 0 upvotes ──
-- The INSERT policy only checks user_id, so a direct API call could
-- submit a prompt with upvotes = 99999 and jump to the top of the list.
CREATE OR REPLACE FUNCTION public.reset_prompt_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.upvotes := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS public_prompts_reset_upvotes ON public.public_prompts;
CREATE TRIGGER public_prompts_reset_upvotes
  BEFORE INSERT ON public.public_prompts
  FOR EACH ROW EXECUTE FUNCTION public.reset_prompt_upvotes();

-- ── 4. Custom genre cards: keep updated_at current on edit ──
DROP TRIGGER IF EXISTS custom_genre_cards_set_updated_at ON public.custom_genre_cards;
CREATE TRIGGER custom_genre_cards_set_updated_at
  BEFORE UPDATE ON public.custom_genre_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
