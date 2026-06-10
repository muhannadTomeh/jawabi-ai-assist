-- Ensure admins can fully manage all chatbots
DROP POLICY IF EXISTS "Users can update their own chatbot or admin can update all" ON public.chatbots;
DROP POLICY IF EXISTS "Users can delete their own chatbot or admin can delete all" ON public.chatbots;
DROP POLICY IF EXISTS "Users can view their own chatbot" ON public.chatbots;

CREATE POLICY "Users or admin can view chatbots"
ON public.chatbots FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users or admin can update chatbots"
ON public.chatbots FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users or admin can delete chatbots"
ON public.chatbots FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));