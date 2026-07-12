
REVOKE EXECUTE ON FUNCTION public.acquire_conversation_lock(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_conversation_lock(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_conversation_lock(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_conversation_lock(uuid, text) TO service_role;
