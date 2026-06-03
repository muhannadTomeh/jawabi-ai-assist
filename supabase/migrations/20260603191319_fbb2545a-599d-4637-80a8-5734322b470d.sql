
CREATE POLICY "Owners insert their notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_chatbot_owner(chatbot_id));

DROP POLICY IF EXISTS "Users can create their own connections" ON public.social_connections;
CREATE POLICY "Users can create their own connections"
ON public.social_connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_chatbot_owner(chatbot_id));

DROP POLICY IF EXISTS "Users can update their own connections" ON public.social_connections;
CREATE POLICY "Users can update their own connections"
ON public.social_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Owners insert telegram messages"
ON public.telegram_messages FOR INSERT TO authenticated
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners update telegram messages"
ON public.telegram_messages FOR UPDATE TO authenticated
USING (public.is_chatbot_owner(chatbot_id))
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners delete telegram messages"
ON public.telegram_messages FOR DELETE TO authenticated
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Owners insert telegram users"
ON public.telegram_users FOR INSERT TO authenticated
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners update telegram users"
ON public.telegram_users FOR UPDATE TO authenticated
USING (public.is_chatbot_owner(chatbot_id))
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners delete telegram users"
ON public.telegram_users FOR DELETE TO authenticated
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Owners insert whatsapp contacts"
ON public.whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners update whatsapp contacts"
ON public.whatsapp_contacts FOR UPDATE TO authenticated
USING (public.is_chatbot_owner(chatbot_id))
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners delete whatsapp contacts"
ON public.whatsapp_contacts FOR DELETE TO authenticated
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Owners insert whatsapp messages"
ON public.whatsapp_messages FOR INSERT TO authenticated
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners update whatsapp messages"
ON public.whatsapp_messages FOR UPDATE TO authenticated
USING (public.is_chatbot_owner(chatbot_id))
WITH CHECK (public.is_chatbot_owner(chatbot_id));
CREATE POLICY "Owners delete whatsapp messages"
ON public.whatsapp_messages FOR DELETE TO authenticated
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
