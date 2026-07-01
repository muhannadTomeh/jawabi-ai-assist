
ALTER TABLE public.handover_settings
  ADD COLUMN IF NOT EXISTS takeover_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeover_timeout_minutes integer NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS public.conversation_takeovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  channel text NOT NULL,
  external_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_human_at timestamptz NOT NULL DEFAULT now(),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chatbot_id, channel, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_takeovers TO authenticated;
GRANT ALL ON public.conversation_takeovers TO service_role;

ALTER TABLE public.conversation_takeovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view takeovers" ON public.conversation_takeovers
  FOR SELECT USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners insert takeovers" ON public.conversation_takeovers
  FOR INSERT TO authenticated WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners update takeovers" ON public.conversation_takeovers
  FOR UPDATE TO authenticated
    USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners delete takeovers" ON public.conversation_takeovers
  FOR DELETE TO authenticated USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_conversation_takeovers_updated_at
  BEFORE UPDATE ON public.conversation_takeovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS conversation_takeovers_lookup_idx
  ON public.conversation_takeovers (chatbot_id, channel, external_id, active);
