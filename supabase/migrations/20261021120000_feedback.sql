-- ============================================================
-- Tester feedback log (Oct 21 2026). Safe to re-run.
-- Anyone can send feedback; only emails in feedback_admins can read it,
-- change its status, or read the anonymous usage stats.
-- ============================================================

-- 1. Who can read the feedback (add your sign-in email at the bottom).
CREATE TABLE IF NOT EXISTS public.feedback_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(email))
);
ALTER TABLE public.feedback_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_feedback_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feedback_admins
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
REVOKE ALL ON FUNCTION public.is_feedback_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feedback_admin() TO anon, authenticated;

-- 2. The log.
CREATE TABLE IF NOT EXISTS public.feedback (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind        TEXT NOT NULL CHECK (kind IN ('bug', 'confusing', 'idea', 'praise')),
  message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  suggestion  TEXT NOT NULL DEFAULT '' CHECK (char_length(suggestion) <= 2000),
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  tester_name TEXT NOT NULL DEFAULT '' CHECK (char_length(tester_name) <= 80),
  page        TEXT NOT NULL DEFAULT '' CHECK (char_length(page) <= 200),
  tool        TEXT NOT NULL DEFAULT '' CHECK (char_length(tool) <= 40),
  device      TEXT NOT NULL DEFAULT '' CHECK (char_length(device) <= 200),
  -- Filled in by the database from the sign-in, never from the browser.
  user_id     UUID,
  user_email  TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'planned', 'done', 'wont_do')),
  admin_note  TEXT NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 1000)
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);

CREATE OR REPLACE FUNCTION public.feedback_stamp_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.user_email := auth.jwt() ->> 'email';
  NEW.status := 'new';
  NEW.admin_note := '';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS feedback_stamp_user ON public.feedback;
CREATE TRIGGER feedback_stamp_user BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_stamp_user();

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM anon, authenticated;
GRANT INSERT (kind, message, suggestion, rating, tester_name, page, tool, device)
  ON public.feedback TO anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;
GRANT UPDATE (status, admin_note) ON public.feedback TO authenticated;

DROP POLICY IF EXISTS "Anyone can send feedback" ON public.feedback;
CREATE POLICY "Anyone can send feedback" ON public.feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read feedback" ON public.feedback;
CREATE POLICY "Admins read feedback" ON public.feedback
  FOR SELECT TO authenticated USING (public.is_feedback_admin());

DROP POLICY IF EXISTS "Admins update feedback" ON public.feedback;
CREATE POLICY "Admins update feedback" ON public.feedback
  FOR UPDATE TO authenticated USING (public.is_feedback_admin()) WITH CHECK (public.is_feedback_admin());

-- 3. Let admins read the anonymous usage stats on the same page.
GRANT SELECT ON public.app_events TO authenticated;
DROP POLICY IF EXISTS "Admins read usage stats" ON public.app_events;
CREATE POLICY "Admins read usage stats" ON public.app_events
  FOR SELECT TO authenticated USING (public.is_feedback_admin());

-- 4. Make yourself an admin: replace the address with the one you sign in with, then run.
-- INSERT INTO public.feedback_admins (email) VALUES (lower('you@example.com')) ON CONFLICT DO NOTHING;
