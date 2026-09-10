CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled session',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own workspaces" ON public.workspaces FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workspaces_user_updated_idx ON public.workspaces (user_id, updated_at DESC);

CREATE TABLE public.prompt_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'style',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_presets TO authenticated;
GRANT SELECT ON public.prompt_presets TO anon;
GRANT ALL ON public.prompt_presets TO service_role;
ALTER TABLE public.prompt_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Starter presets are readable by everyone" ON public.prompt_presets FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Users read their own presets" ON public.prompt_presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own presets" ON public.prompt_presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own presets" ON public.prompt_presets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own presets" ON public.prompt_presets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER prompt_presets_set_updated_at BEFORE UPDATE ON public.prompt_presets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.prompt_presets (user_id, title, body, kind, tags) VALUES
(NULL, 'Late-night synthwave', 'dark synthwave, 104 bpm, analog poly pads, gated snare, breathy female vocal, tape saturation, nocturnal', 'style', ARRAY['synth','dark','retro']),
(NULL, 'Dust-belt americana', 'alt-country americana, 88 bpm, brushed drums, baritone guitar, pedal steel, cracked male vocal, room mics, weary', 'style', ARRAY['country','organic']),
(NULL, 'Warehouse UK garage', '2-step UK garage, 134 bpm, shuffled hats, sub bass, chopped diva vocal, dub delay, humid', 'style', ARRAY['dance','uk','club']),
(NULL, 'Blown-out shoegaze', 'shoegaze, 96 bpm, wall-of-fuzz guitars, buried mixed vocals, tremolo, cassette hiss, euphoric grief', 'style', ARRAY['rock','noise']),
(NULL, 'Neo-soul slow burn', 'neo-soul, 72 bpm, rhodes, fretless bass, loose live drums, layered alto harmonies, warm compression, intimate', 'style', ARRAY['soul','warm']),
(NULL, 'One concrete scene', 'Write the whole song inside one physical location, one hour of the night. Name three real objects. No abstractions in the chorus.', 'lyric', ARRAY['brief','imagery']),
(NULL, 'Chantable hook first', 'The chorus hook must be under six words, land in the first five words of the section, and repeat three times with one word changed each time.', 'lyric', ARRAY['brief','hook']),
(NULL, 'Second-person accusation', 'Address one person directly the whole song. Present tense. No apologies, no resolution in the final verse.', 'lyric', ARRAY['brief','voice']),
(NULL, 'Short-line pressure', 'Maximum seven syllables per line. Verses build tension, pre-chorus withholds, chorus releases with longer vowels.', 'lyric', ARRAY['brief','rhythm']),
(NULL, 'Classic pop structure', '[Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Pre-Chorus] [Chorus] [Bridge] [Chorus] [Outro]', 'structure', ARRAY['structure','pop']),
(NULL, 'Hook-front structure', '[Chorus] [Verse 1] [Chorus] [Verse 2] [Bridge] [Chorus] [Chorus]', 'structure', ARRAY['structure','radio']),
(NULL, 'Slow-build structure', '[Intro] [Verse 1] [Verse 2] [Pre-Chorus] [Chorus] [Bridge] [Chorus] [Outro]', 'structure', ARRAY['structure','cinematic']);