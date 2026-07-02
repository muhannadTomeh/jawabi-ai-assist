
-- 1) Add bot_mode + owner_telegram_chat_id to chatbots
ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS bot_mode TEXT NOT NULL DEFAULT 'inquiries_sales',
  ADD COLUMN IF NOT EXISTS owner_telegram_chat_id TEXT;

ALTER TABLE public.chatbots
  DROP CONSTRAINT IF EXISTS chatbots_bot_mode_check;
ALTER TABLE public.chatbots
  ADD CONSTRAINT chatbots_bot_mode_check
  CHECK (bot_mode IN ('inquiries_only','inquiries_sales','inquiries_sales_followup'));

-- 2) Remove unused trigger_on_low_confidence from handover_settings
ALTER TABLE public.handover_settings
  DROP COLUMN IF EXISTS trigger_on_low_confidence;

-- 3) Track pending sale notifications so we can wire the Confirm button
--    and detect owner manual replies for takeover.
CREATE TABLE IF NOT EXISTS public.pending_sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  customer_external_id TEXT NOT NULL,
  customer_name TEXT,
  summary TEXT,
  owner_chat_id TEXT NOT NULL,
  owner_message_id BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pending_sale_orders TO authenticated;
GRANT ALL ON public.pending_sale_orders TO service_role;

ALTER TABLE public.pending_sale_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chatbot owners can view their pending orders"
  ON public.pending_sale_orders FOR SELECT
  TO authenticated
  USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Service role manages pending orders"
  ON public.pending_sale_orders FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pending_sale_owner_msg
  ON public.pending_sale_orders (owner_chat_id, owner_message_id);

CREATE TRIGGER update_pending_sale_orders_updated_at
  BEFORE UPDATE ON public.pending_sale_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
