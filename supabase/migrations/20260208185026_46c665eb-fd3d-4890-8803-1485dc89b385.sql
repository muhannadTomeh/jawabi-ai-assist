
-- Table for telegram bot users
CREATE TABLE public.telegram_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  first_name TEXT,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(telegram_user_id, chatbot_id)
);

-- Table for conversation messages (last 5 per user)
CREATE TABLE public.telegram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_lookup ON public.telegram_messages(telegram_user_id, chatbot_id, created_at DESC);
CREATE INDEX idx_telegram_users_lookup ON public.telegram_users(telegram_user_id, chatbot_id);

-- RLS - these tables are accessed via service role key in edge functions
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Allow chatbot owners to view their bot's users/messages
CREATE POLICY "Owners can view telegram users" ON public.telegram_users FOR SELECT USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can view telegram messages" ON public.telegram_messages FOR SELECT USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));
