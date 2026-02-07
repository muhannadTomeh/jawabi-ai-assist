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

async function generateAIResponse(
  userMessage: string,
  knowledgeContext: string,
  chatbot: { name: string; tone: string; language: string; fallback_message: string }
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, using fallback");
    return chatbot.fallback_message;
  }

  const systemPrompt = `أنت مساعد ذكي اسمك "${chatbot.name}".
نبرتك: ${chatbot.tone}
اللغة: ${chatbot.language}

قاعدة المعرفة الخاصة بك:
${knowledgeContext || "لا توجد معلومات في قاعدة المعرفة حالياً."}

التعليمات:
- أجب على أسئلة المستخدم بناءً على قاعدة المعرفة المتاحة فقط.
- إذا لم تجد إجابة في قاعدة المعرفة، أجب بـ: "${chatbot.fallback_message}"
- كن مختصراً ومفيداً.
- لا تذكر أنك تستخدم "قاعدة معرفة" - تحدث بشكل طبيعي.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return chatbot.fallback_message;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || chatbot.fallback_message;
  } catch (error) {
    console.error("AI call failed:", error);
    return chatbot.fallback_message;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === "telegram-webhook") {
      return new Response(JSON.stringify({ error: "Missing bot token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find channel - use config::text LIKE to avoid JSON parsing issues with colons
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("*, chatbots(*)")
      .eq("platform", "telegram")
      .eq("is_connected", true)
      .filter("config->>bot_token", "eq", botToken)
      .maybeSingle();

    if (channelError || !channel) {
      console.error("Channel not found:", channelError);
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Build knowledge context from all knowledge items
    const { data: knowledgeItems } = await supabase
      .from("knowledge_items")
      .select("*")
      .eq("chatbot_id", chatbot.id);

    let knowledgeContext = "";
    if (knowledgeItems && knowledgeItems.length > 0) {
      const parts: string[] = [];
      for (const item of knowledgeItems) {
        if (item.type === "faq" && item.question && item.answer) {
          parts.push(`سؤال: ${item.question}\nجواب: ${item.answer}`);
        } else if (item.type === "text" && item.content) {
          parts.push(`${item.title}:\n${item.content}`);
        } else if (item.type === "file" && item.content) {
          parts.push(`ملف "${item.title}":\n${item.content}`);
        }
      }
      knowledgeContext = parts.join("\n\n---\n\n");
    }

    // Generate AI response
    const responseText = await generateAIResponse(userMessage, knowledgeContext, chatbot);

    // Send to Telegram
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
      console.error("Telegram API error:", await telegramResponse.text());
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
