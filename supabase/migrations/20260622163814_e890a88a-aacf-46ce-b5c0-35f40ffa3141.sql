
CREATE TABLE IF NOT EXISTS public.llm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  custom_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_settings TO authenticated;
GRANT ALL ON public.llm_settings TO service_role;

ALTER TABLE public.llm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read llm settings" ON public.llm_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert llm settings" ON public.llm_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update llm settings" ON public.llm_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete llm settings" ON public.llm_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.llm_settings (model) SELECT 'google/gemini-2.5-flash' WHERE NOT EXISTS (SELECT 1 FROM public.llm_settings);

UPDATE public.chatbots SET public_slug = encode(gen_random_bytes(8), 'hex') WHERE public_slug IS NULL;

CREATE OR REPLACE FUNCTION public.set_chatbot_public_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_slug IS NULL THEN
    NEW.public_slug := encode(gen_random_bytes(8), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chatbots_set_public_slug ON public.chatbots;
CREATE TRIGGER trg_chatbots_set_public_slug BEFORE INSERT ON public.chatbots FOR EACH ROW EXECUTE FUNCTION public.set_chatbot_public_slug();

CREATE OR REPLACE FUNCTION public.get_chatbot_by_slug(_slug text)
RETURNS TABLE (id uuid, name text, welcome_message text, fallback_message text, language text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.welcome_message, c.fallback_message, c.language
  FROM public.chatbots c
  WHERE c.public_slug = _slug AND c.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_chatbot_by_slug(text) TO anon, authenticated;
