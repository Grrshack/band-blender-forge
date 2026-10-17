-- ============================================================
-- Recipes: community prompts that come with the song they made.
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.public_prompts ADD COLUMN IF NOT EXISTS suno_url TEXT;
ALTER TABLE public.public_prompts ADD COLUMN IF NOT EXISTS recipe_note TEXT;

-- Only links to suno.com, so a recipe can't point people anywhere else.
ALTER TABLE public.public_prompts DROP CONSTRAINT IF EXISTS public_prompts_suno_url_check;
ALTER TABLE public.public_prompts ADD CONSTRAINT public_prompts_suno_url_check
  CHECK (suno_url IS NULL OR suno_url ~ '^https://(www\.)?suno\.com/');

ALTER TABLE public.public_prompts DROP CONSTRAINT IF EXISTS public_prompts_recipe_note_len;
ALTER TABLE public.public_prompts ADD CONSTRAINT public_prompts_recipe_note_len
  CHECK (recipe_note IS NULL OR char_length(recipe_note) <= 300);

CREATE INDEX IF NOT EXISTS public_prompts_recipes_idx
  ON public.public_prompts (upvotes DESC, created_at DESC)
  WHERE suno_url IS NOT NULL;
