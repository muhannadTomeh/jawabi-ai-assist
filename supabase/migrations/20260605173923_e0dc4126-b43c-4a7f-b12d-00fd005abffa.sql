
CREATE OR REPLACE FUNCTION public.record_customer_contact(
  _chatbot_id UUID,
  _channel TEXT,
  _external_id TEXT,
  _name TEXT DEFAULT NULL,
  _username TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _last_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.customers AS c
    (chatbot_id, channel, external_id, name, username, phone, last_message, message_count, first_seen_at, last_seen_at)
  VALUES
    (_chatbot_id, _channel, _external_id, _name, _username, _phone, _last_message, 1, now(), now())
  ON CONFLICT (chatbot_id, channel, external_id) DO UPDATE
    SET message_count = c.message_count + 1,
        last_seen_at = now(),
        last_message = COALESCE(EXCLUDED.last_message, c.last_message),
        name = COALESCE(EXCLUDED.name, c.name),
        username = COALESCE(EXCLUDED.username, c.username),
        phone = COALESCE(EXCLUDED.phone, c.phone),
        updated_at = now()
  RETURNING c.id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_customer_contact(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_contact(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
