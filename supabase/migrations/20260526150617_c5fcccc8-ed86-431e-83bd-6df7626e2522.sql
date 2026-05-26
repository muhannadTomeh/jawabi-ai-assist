
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,
  last_message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_chatbot_created ON public.notifications(chatbot_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(chatbot_id, is_read) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their notifications"
ON public.notifications FOR SELECT
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners update their notifications"
ON public.notifications FOR UPDATE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete their notifications"
ON public.notifications FOR DELETE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
