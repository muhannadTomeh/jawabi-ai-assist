import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Chatbot {
  id: string;
  name: string;
  user_id: string;
  is_active: boolean;
  language: string;
  tone: string;
  fallback_message: string;
  created_at: string;
  updated_at: string;
}

export function useChatbot() {
  const { user } = useAuth();
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrCreateChatbot() {
      if (!user) {
        setChatbot(null);
        setLoading(false);
        return;
      }

      try {
        // Try to fetch existing chatbot
        const { data: existingChatbot, error: fetchError } = await supabase
          .from('chatbots')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingChatbot) {
          setChatbot(existingChatbot);
        } else {
          // Create a default chatbot for the user
          const { data: newChatbot, error: createError } = await supabase
            .from('chatbots')
            .insert({
              user_id: user.id,
              name: 'شات بوت جديد',
            })
            .select()
            .single();

          if (createError) throw createError;

          setChatbot(newChatbot);
        }
      } catch (err) {
        console.error('Error fetching/creating chatbot:', err);
        setError('حدث خطأ في تحميل الشات بوت');
      } finally {
        setLoading(false);
      }
    }

    fetchOrCreateChatbot();
  }, [user]);

  const updateChatbot = async (updates: Partial<Chatbot>) => {
    if (!chatbot) return;

    try {
      const { data, error } = await supabase
        .from('chatbots')
        .update(updates)
        .eq('id', chatbot.id)
        .select()
        .single();

      if (error) throw error;

      setChatbot(data);
      return { success: true };
    } catch (err) {
      console.error('Error updating chatbot:', err);
      return { success: false, error: err };
    }
  };

  return { chatbot, loading, error, updateChatbot };
}
