-- Per-user usage log used to rate-limit the built-in AI model.
-- Users can only see and add their own rows; nothing else can read them.
CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_user_created_idx ON public.ai_usage (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own usage" ON public.ai_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users log their own usage" ON public.ai_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Old rows are only needed for the rolling one-hour window. Call this on a schedule
-- (pg_cron or a cron-authenticated route); it is not callable from the API.
CREATE OR REPLACE FUNCTION public.purge_ai_usage()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_usage WHERE created_at < now() - interval '2 days';
$$;
REVOKE ALL ON FUNCTION public.purge_ai_usage() FROM PUBLIC, anon, authenticated;
