-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chatbots table (one per user for MVP)
CREATE TABLE public.chatbots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'العربية',
    tone TEXT NOT NULL DEFAULT 'professional',
    fallback_message TEXT NOT NULL DEFAULT 'عذراً، لم أستطع فهم سؤالك. سيتواصل معك أحد أعضاء الفريق قريباً.',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create knowledge_items table
CREATE TABLE public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID REFERENCES public.chatbots(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'faq', 'file')),
    title TEXT NOT NULL,
    content TEXT,
    question TEXT,
    answer TEXT,
    file_name TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create channels table
CREATE TABLE public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID REFERENCES public.chatbots(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'messenger')),
    is_connected BOOLEAN NOT NULL DEFAULT false,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(chatbot_id, platform)
);

-- Create handover_settings table
CREATE TABLE public.handover_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID REFERENCES public.chatbots(id) ON DELETE CASCADE NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_on_low_confidence BOOLEAN NOT NULL DEFAULT true,
    low_confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    trigger_keywords TEXT[] NOT NULL DEFAULT ARRAY['بشري', 'موظف', 'مساعدة', 'دعم'],
    failed_responses_threshold INTEGER NOT NULL DEFAULT 3,
    handover_message TEXT NOT NULL DEFAULT 'سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة. يرجى الانتظار لحظة.',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper function to check chatbot ownership
CREATE OR REPLACE FUNCTION public.is_chatbot_owner(chatbot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chatbots
    WHERE id = chatbot_id
      AND user_id = auth.uid()
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- User roles policies (read-only for users, admins can manage)
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Chatbots policies
CREATE POLICY "Users can view their own chatbot"
ON public.chatbots FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own chatbot"
ON public.chatbots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chatbot"
ON public.chatbots FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chatbot"
ON public.chatbots FOR DELETE
USING (auth.uid() = user_id);

-- Knowledge items policies
CREATE POLICY "Users can view their chatbot's knowledge"
ON public.knowledge_items FOR SELECT
USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create knowledge for their chatbot"
ON public.knowledge_items FOR INSERT
WITH CHECK (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can update their chatbot's knowledge"
ON public.knowledge_items FOR UPDATE
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can delete their chatbot's knowledge"
ON public.knowledge_items FOR DELETE
USING (public.is_chatbot_owner(chatbot_id));

-- Channels policies
CREATE POLICY "Users can view their chatbot's channels"
ON public.channels FOR SELECT
USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create channels for their chatbot"
ON public.channels FOR INSERT
WITH CHECK (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can update their chatbot's channels"
ON public.channels FOR UPDATE
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can delete their chatbot's channels"
ON public.channels FOR DELETE
USING (public.is_chatbot_owner(chatbot_id));

-- Handover settings policies
CREATE POLICY "Users can view their chatbot's handover settings"
ON public.handover_settings FOR SELECT
USING (public.is_chatbot_owner(chatbot_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create handover settings for their chatbot"
ON public.handover_settings FOR INSERT
WITH CHECK (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can update their chatbot's handover settings"
ON public.handover_settings FOR UPDATE
USING (public.is_chatbot_owner(chatbot_id));

CREATE POLICY "Users can delete their chatbot's handover settings"
ON public.handover_settings FOR DELETE
USING (public.is_chatbot_owner(chatbot_id));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile and role on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbots_updated_at
BEFORE UPDATE ON public.chatbots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_handover_settings_updated_at
BEFORE UPDATE ON public.handover_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();