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

function getDialectInstruction(dialect: string): string {
  if (dialect === "palestinian") {
    return `\n\nاللهجة: تحدث باللهجة العامية الفلسطينية. استخدم تعبيرات مثل "كيفك"، "شو"، "هلأ"، "إنشاء الله"، "يعطيك العافية" وما شابه. لا تستخدم الفصحى.`;
  }
  return `\n\nاللهجة: تحدث بالعربية الفصحى الرسمية.`;
}

async function generateAIResponse(
  userMessage: string,
  knowledgeContext: string,
  chatbot: { name: string; tone: string; language: string; fallback_message: string; custom_instructions: string; dialect: string },
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, using fallback");
    return chatbot.fallback_message;
  }

  const customInstructions = chatbot.custom_instructions
    ? `\n\nتعليمات إضافية من المالك:\n${chatbot.custom_instructions}`
    : "";

  const dialectInstruction = getDialectInstruction(chatbot.dialect || "formal");

  const systemPrompt = `أنت مساعد ذكي اسمك "${chatbot.name}".
نبرتك: ${chatbot.tone}
اللغة: ${chatbot.language}${dialectInstruction}

قاعدة المعرفة الخاصة بك:
${knowledgeContext || "لا توجد معلومات في قاعدة المعرفة حالياً."}

التعليمات:
- أجب على أسئلة المستخدم بناءً على قاعدة المعرفة المتاحة فقط.
- إذا لم تجد إجابة في قاعدة المعرفة، أجب بـ: "${chatbot.fallback_message}"
- كن مختصراً ومفيداً.
- لا تذكر أنك تستخدم "قاعدة معرفة" - تحدث بشكل طبيعي.
- لا ترحب بالمستخدم ولا تقل "أهلاً" أو "مرحباً" في بداية كل رد. ادخل في الموضوع مباشرة.
- لديك ذاكرة محادثة - استخدم السياق السابق للرد بشكل متسق وطبيعي.${customInstructions}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
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

async function getOrCreateUser(
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
  chatbotId: string,
  firstName: string,
  username?: string
): Promise<{ isNew: boolean }> {
  const { data: existing } = await supabase
    .from("telegram_users")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .eq("chatbot_id", chatbotId)
    .maybeSingle();

  if (existing) return { isNew: false };

  await supabase.from("telegram_users").insert({
    telegram_user_id: telegramUserId,
    chatbot_id: chatbotId,
    first_name: firstName,
    username: username || null,
  });

  return { isNew: true };
}

async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
  chatbotId: string
): Promise<{ role: string; content: string }[]> {
  const { data } = await supabase
    .from("telegram_messages")
    .select("role, content")
    .eq("telegram_user_id", telegramUserId)
    .eq("chatbot_id", chatbotId)
    .order("created_at", { ascending: true })
    .limit(10);

  return data || [];
}

async function saveMessages(
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
  chatbotId: string,
  userMsg: string,
  assistantMsg: string
) {
  await supabase.from("telegram_messages").insert([
    { telegram_user_id: telegramUserId, chatbot_id: chatbotId, role: "user", content: userMsg },
    { telegram_user_id: telegramUserId, chatbot_id: chatbotId, role: "assistant", content: assistantMsg },
  ]);

  const { data: allMsgs } = await supabase
    .from("telegram_messages")
    .select("id, created_at")
    .eq("telegram_user_id", telegramUserId)
    .eq("chatbot_id", chatbotId)
    .order("created_at", { ascending: false });

  if (allMsgs && allMsgs.length > 10) {
    const idsToDelete = allMsgs.slice(10).map((m) => m.id);
    await supabase.from("telegram_messages").delete().in("id", idsToDelete);
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
    const telegramUserId = update.message.from.id;
    const firstName = update.message.from.first_name;
    const username = update.message.from.username;
    const userMessage = update.message.text;
    const chatbot = channel.chatbots;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Register user (track new vs existing)
    const { isNew } = await getOrCreateUser(supabase, telegramUserId, chatbot.id, firstName, username);

    // Handle /start command - always send welcome
    if (userMessage === "/start") {
      const welcomeMsg = chatbot.welcome_message || `مرحباً! أنا ${chatbot.name}. كيف يمكنني مساعدتك؟`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: welcomeMsg }),
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For new users (first message without /start), send welcome THEN process
    if (isNew) {
      const welcomeMsg = chatbot.welcome_message || `مرحباً ${firstName}! أنا ${chatbot.name}. كيف يمكنني مساعدتك؟`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: welcomeMsg }),
      });
    }

    // Get conversation history
    const conversationHistory = await getConversationHistory(supabase, telegramUserId, chatbot.id);

    // Build knowledge context
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

    // Generate AI response with conversation history
    const responseText = await generateAIResponse(userMessage, knowledgeContext, chatbot, conversationHistory);

    // Save messages
    await saveMessages(supabase, telegramUserId, chatbot.id, userMessage, responseText);

    // Send response
    const telegramResponse = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: responseText }),
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
