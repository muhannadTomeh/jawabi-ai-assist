
CREATE TABLE IF NOT EXISTS public.messenger_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  messenger_user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_lookup ON public.messenger_messages (chatbot_id, messenger_user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messenger_messages TO authenticated;
GRANT ALL ON public.messenger_messages TO service_role;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chatbot owners can view their messenger messages"
  ON public.messenger_messages FOR SELECT TO authenticated
  USING (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Service role manages messenger messages"
  ON public.messenger_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messenger_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  messenger_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (chatbot_id, messenger_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messenger_users TO authenticated;
GRANT ALL ON public.messenger_users TO service_role;
ALTER TABLE public.messenger_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chatbot owners can view their messenger users"
  ON public.messenger_users FOR SELECT TO authenticated
  USING (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Service role manages messenger users"
  ON public.messenger_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);
