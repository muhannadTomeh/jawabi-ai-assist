
CREATE TYPE public.customer_tag AS ENUM ('new', 'prospect', 'regular', 'vip', 'blocked');

CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  username TEXT,
  phone TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,
  tag public.customer_tag NOT NULL DEFAULT 'new',
  notes TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_unique_per_channel UNIQUE (chatbot_id, channel, external_id)
);

CREATE INDEX customers_chatbot_idx ON public.customers (chatbot_id);
CREATE INDEX customers_last_seen_idx ON public.customers (chatbot_id, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view customers"
  ON public.customers FOR SELECT
  USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Owners update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
