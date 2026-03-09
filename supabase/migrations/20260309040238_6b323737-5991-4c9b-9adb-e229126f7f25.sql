-- Create whatsapp_contacts table to store WhatsApp user info
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chatbot_id, phone_number)
);

-- Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_contacts
CREATE POLICY "Owners can view whatsapp contacts"
  ON public.whatsapp_contacts
  FOR SELECT
  USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Create whatsapp_messages table to store conversation history
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_messages
CREATE POLICY "Owners can view whatsapp messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_whatsapp_messages_chatbot_phone ON public.whatsapp_messages(chatbot_id, phone_number, created_at DESC);
CREATE INDEX idx_whatsapp_contacts_chatbot ON public.whatsapp_contacts(chatbot_id);

-- Create web_chat_messages table to store TestChat conversation history
CREATE TABLE public.web_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.web_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for web_chat_messages
CREATE POLICY "Users can view their own chat messages"
  ON public.web_chat_messages
  FOR SELECT
  USING (auth.uid() = user_id OR is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own chat messages"
  ON public.web_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_web_chat_messages_user_chatbot ON public.web_chat_messages(user_id, chatbot_id, created_at DESC);