import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChatbot } from "./useChatbot";

export interface Notification {
  id: string;
  chatbot_id: string;
  type: string;
  title: string;
  channel: string;
  contact_identifier: string;
  contact_name: string | null;
  last_message: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export function useNotifications() {
  const { chatbot } = useChatbot();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async (chatbotId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!chatbot?.id) return;
    fetchAll(chatbot.id);

    const channel = supabase
      .channel(`notifications-${chatbot.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `chatbot_id=eq.${chatbot.id}` },
        () => fetchAll(chatbot.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatbot?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    if (!chatbot?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("chatbot_id", chatbot.id).eq("is_read", false);
  };

  const resolve = async (id: string) => {
    await supabase.from("notifications").update({ is_resolved: true, is_read: true }).eq("id", id);
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
  };

  return { notifications, loading, unreadCount, markRead, markAllRead, resolve, remove };
}