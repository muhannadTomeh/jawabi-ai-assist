
ALTER TABLE public.chatbots
ADD COLUMN welcome_message text NOT NULL DEFAULT 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
ADD COLUMN custom_instructions text NOT NULL DEFAULT '';
