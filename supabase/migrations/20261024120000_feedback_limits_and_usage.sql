-- ============================================================
-- Oct 24 2026. Safe to re-run. Needs the Oct 18 (app_events) and Oct 21 (feedback) SQL first.
-- 1. A spam limit on feedback.
-- 2. Usage totals counted in the database, so the admin page isn't capped at 1,000 rows.
-- ============================================================

-- 1. At most 20 feedback entries a minute from everyone combined; plenty for testers,
--    and stops anyone flooding the log.
CREATE OR REPLACE FUNCTION public.feedback_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.feedback WHERE created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'Too much feedback right now. Try again in a minute.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS feedback_rate_limit ON public.feedback;
CREATE TRIGGER feedback_rate_limit BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_rate_limit();

-- 2. Usage totals for the last N days, for admins only.
CREATE OR REPLACE FUNCTION public.admin_usage_summary(days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
BEGIN
  IF NOT public.is_feedback_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'sessions', (SELECT count(DISTINCT session_id) FROM public.app_events WHERE created_at >= since),
    'tools', coalesce((
      SELECT jsonb_agg(jsonb_build_object('key', detail, 'count', n) ORDER BY n DESC)
      FROM (SELECT detail, count(DISTINCT session_id) AS n FROM public.app_events
            WHERE created_at >= since AND event = 'tab_open' GROUP BY detail) t), '[]'::jsonb),
    'starts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('key', detail, 'count', n) ORDER BY n DESC)
      FROM (SELECT detail, count(*) AS n FROM public.app_events
            WHERE created_at >= since AND event = 'start_choice' GROUP BY detail) t), '[]'::jsonb),
    'actions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('key', event, 'count', n) ORDER BY n DESC)
      FROM (SELECT event, count(*) AS n FROM public.app_events
            WHERE created_at >= since AND event NOT IN ('tab_open', 'start_choice') GROUP BY event) t), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_usage_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_usage_summary(integer) TO authenticated;
