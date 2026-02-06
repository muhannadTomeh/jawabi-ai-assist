import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get bot token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === "telegram-webhook") {
      return new Response(JSON.stringify({ error: "Missing bot token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the channel with this bot token
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("*, chatbots(*)")
      .eq("platform", "telegram")
      .eq("is_connected", true)
      .filter("config->bot_token", "eq", botToken)
      .maybeSingle();

    if (channelError || !channel) {
      console.error("Channel not found:", channelError);
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the incoming update
    const update: TelegramUpdate = await req.json();
    console.log("Received Telegram update:", JSON.stringify(update));

    if (!update.message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = update.message.chat.id;
    const userMessage = update.message.text;
    const chatbot = channel.chatbots;

    // Generate response based on knowledge base (simplified for now)
    let responseText = chatbot.fallback_message;

    // Check knowledge base for matching FAQ
    const { data: faqs } = await supabase
      .from("knowledge_items")
      .select("*")
      .eq("chatbot_id", chatbot.id)
      .eq("type", "faq");

    if (faqs && faqs.length > 0) {
      // Simple keyword matching
      const matchedFaq = faqs.find(
        (faq) =>
          faq.question &&
          userMessage.toLowerCase().includes(faq.question.toLowerCase())
      );
      if (matchedFaq && matchedFaq.answer) {
        responseText = matchedFaq.answer;
      }
    }

    // Send response to Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const telegramResponse = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
      }),
    });

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.text();
      console.error("Telegram API error:", errorData);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
