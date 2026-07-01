
-- 1) Hide access_token column from client roles on social_connections
REVOKE SELECT ON public.social_connections FROM authenticated, anon;
GRANT SELECT (id, user_id, chatbot_id, platform, page_id, page_name, token_expiry, metadata, created_at, updated_at, bot_status)
  ON public.social_connections TO authenticated;

-- 2) Tighten SECURITY DEFINER function execute grants
REVOKE ALL ON FUNCTION public.get_chatbot_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chatbot_by_slug(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.set_chatbot_public_slug() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
