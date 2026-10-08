CREATE OR REPLACE FUNCTION public.increment_upvote()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN
  UPDATE public.public_prompts SET upvotes = upvotes + 1 WHERE id = NEW.prompt_id;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.decrement_upvote()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN
  UPDATE public.public_prompts SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.prompt_id;
  RETURN OLD;
END; $$;