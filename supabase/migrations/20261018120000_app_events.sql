-- ============================================================
-- Anonymous tool-usage counts (Oct 18 2026). Safe to re-run.
-- No user id, no IP, no cookie: an event name, a short detail
-- (e.g. which tab) and a random id that lives only in one browser tab.
-- Visitor numbers come from Lovable's built-in Analytics; this only
-- answers "which tools do people use, and where do they stop?".
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 40),
  event       TEXT NOT NULL CHECK (event IN (
                'tab_open', 'start_choice', 'key_dialog_open', 'key_saved', 'key_test',
                'ai_call', 'ai_error', 'master_loaded', 'master_export',
                'recipe_shared', 'take_logged', 'guide_view')),
  detail      TEXT NOT NULL DEFAULT '' CHECK (char_length(detail) <= 40)
);

CREATE INDEX IF NOT EXISTS app_events_created_idx ON public.app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_event_idx ON public.app_events (event, created_at DESC);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Anyone may add an event; nobody can read them through the API.
-- You read them in Lovable's SQL panel, which has admin rights.
REVOKE ALL ON public.app_events FROM anon, authenticated;
GRANT INSERT (session_id, event, detail) ON public.app_events TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can log an anonymous event" ON public.app_events;
CREATE POLICY "Anyone can log an anonymous event"
  ON public.app_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Keep the table small: delete events older than a year. Run it by hand now and then:
--   SELECT public.purge_app_events();
CREATE OR REPLACE FUNCTION public.purge_app_events()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.app_events WHERE created_at < now() - interval '365 days';
$$;
REVOKE ALL ON FUNCTION public.purge_app_events() FROM PUBLIC, anon, authenticated;
