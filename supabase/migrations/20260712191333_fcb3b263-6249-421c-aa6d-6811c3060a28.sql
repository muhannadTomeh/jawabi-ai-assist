
CREATE TABLE IF NOT EXISTS public.conversation_locks (
  chatbot_id uuid NOT NULL,
  external_id text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chatbot_id, external_id)
);

GRANT ALL ON public.conversation_locks TO service_role;
ALTER TABLE public.conversation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manages_locks" ON public.conversation_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.acquire_conversation_lock(
  p_chatbot_id uuid,
  p_external_id text,
  p_timeout_ms integer DEFAULT 20000,
  p_stale_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts timestamptz := clock_timestamp();
BEGIN
  LOOP
    DELETE FROM public.conversation_locks
     WHERE chatbot_id = p_chatbot_id
       AND external_id = p_external_id
       AND locked_at < now() - make_interval(secs => p_stale_seconds);
    BEGIN
      INSERT INTO public.conversation_locks(chatbot_id, external_id, locked_at)
      VALUES (p_chatbot_id, p_external_id, now());
      RETURN true;
    EXCEPTION WHEN unique_violation THEN
      IF (extract(epoch from clock_timestamp() - start_ts) * 1000) > p_timeout_ms THEN
        RETURN false;
      END IF;
      PERFORM pg_sleep(0.15);
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_conversation_lock(
  p_chatbot_id uuid,
  p_external_id text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.conversation_locks
   WHERE chatbot_id = p_chatbot_id AND external_id = p_external_id;
$$;
