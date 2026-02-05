-- Update profiles policy to allow admins to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile or admin can view all"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any profile (careful with this!)
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update chatbots policies for admin full access
DROP POLICY IF EXISTS "Users can update their own chatbot" ON public.chatbots;
CREATE POLICY "Users can update their own chatbot or admin can update all"
ON public.chatbots
FOR UPDATE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their own chatbot" ON public.chatbots;
CREATE POLICY "Users can delete their own chatbot or admin can delete all"
ON public.chatbots
FOR DELETE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Update channels policies for admin full access
DROP POLICY IF EXISTS "Users can update their chatbot's channels" ON public.channels;
CREATE POLICY "Users can update their chatbot's channels or admin can update all"
ON public.channels
FOR UPDATE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their chatbot's channels" ON public.channels;
CREATE POLICY "Users can delete their chatbot's channels or admin can delete all"
ON public.channels
FOR DELETE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Update knowledge_items policies for admin full access
DROP POLICY IF EXISTS "Users can update their chatbot's knowledge" ON public.knowledge_items;
CREATE POLICY "Users can update their chatbot's knowledge or admin can update all"
ON public.knowledge_items
FOR UPDATE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their chatbot's knowledge" ON public.knowledge_items;
CREATE POLICY "Users can delete their chatbot's knowledge or admin can delete all"
ON public.knowledge_items
FOR DELETE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Update handover_settings policies for admin full access
DROP POLICY IF EXISTS "Users can update their chatbot's handover settings" ON public.handover_settings;
CREATE POLICY "Users can update their chatbot's handover settings or admin can update all"
ON public.handover_settings
FOR UPDATE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their chatbot's handover settings" ON public.handover_settings;
CREATE POLICY "Users can delete their chatbot's handover settings or admin can delete all"
ON public.handover_settings
FOR DELETE
USING (is_chatbot_owner(chatbot_id) OR has_role(auth.uid(), 'admin'::app_role));