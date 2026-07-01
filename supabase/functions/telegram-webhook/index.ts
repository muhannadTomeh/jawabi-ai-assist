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

    // If bot is disabled, acknowledge silently and skip processing
    if (channel.bot_status && channel.bot_status !== "active") {
      console.log("Telegram bot is inactive, skipping reply");
      return new Response(JSON.stringify({ ok: true, skipped: "inactive" }), {
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

    // Record/Upsert customer profile (dedup per chatbot+channel+external_id)
    await supabase.rpc("record_customer_contact", {
      _chatbot_id: chatbot.id,
      _channel: "telegram",
      _external_id: String(telegramUserId),
      _name: firstName || null,
      _username: username || null,
      _phone: null,
      _last_message: userMessage,
    });

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

    // Fetch handover settings
    const { data: handover } = await supabase
      .from("handover_settings")
      .select("*")
      .eq("chatbot_id", chatbot.id)
      .maybeSingle();

    // Human takeover: if a human recently intervened in this conversation, stay silent
    if (handover?.takeover_mode_enabled) {
      const { data: takeover } = await supabase
        .from("conversation_takeovers")
        .select("active,last_human_at")
        .eq("chatbot_id", chatbot.id)
        .eq("channel", "telegram")
        .eq("external_id", String(telegramUserId))
        .maybeSingle();
      if (takeover?.active) {
        const timeoutMin = handover.takeover_timeout_minutes || 60;
        const lastHuman = new Date(takeover.last_human_at as string).getTime();
        const stillActive = Date.now() - lastHuman < timeoutMin * 60 * 1000;
        if (stillActive) {
          // Save the user's message but do NOT generate a bot reply
          await supabase.from("telegram_messages").insert({
            telegram_user_id: telegramUserId,
            chatbot_id: chatbot.id,
            role: "user",
            content: userMessage,
          });
          console.log("Skipping bot: conversation under human takeover", telegramUserId);
          return new Response(JSON.stringify({ ok: true, takeover: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Auto-expire takeover
          await supabase
            .from("conversation_takeovers")
            .update({ active: false })
            .eq("chatbot_id", chatbot.id)
            .eq("channel", "telegram")
            .eq("external_id", String(telegramUserId));
        }
      }
    }

    // Helper to create a notification
    const createNotification = async (type: string, title: string) => {
      await supabase.from("notifications").insert({
        chatbot_id: chatbot.id,
        type,
        title,
        channel: "telegram",
        contact_identifier: String(telegramUserId),
        contact_name: firstName || username || null,
        last_message: userMessage,
      });
    };

    // Keyword-based handover
    if (handover?.enabled && Array.isArray(handover.trigger_keywords)) {
      const lower = userMessage.toLowerCase();
      const triggered = handover.trigger_keywords.some(
        (kw: string) => kw && lower.includes(kw.toLowerCase())
      );
      if (triggered) {
        const handoverMsg = handover.handover_message ||
          "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
        await saveMessages(supabase, telegramUserId, chatbot.id, userMessage, handoverMsg);
        await createNotification("human_request", "طلب التحدث مع موظف");
        await fetch(telegramApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: handoverMsg }),
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Sale-intent detection
    if (handover?.enabled) {
      try {
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        const intentRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  'صنّف الرسالة. أجب فقط بكلمة واحدة: "sale" إذا كان الزبون يريد إجراء عملية شراء حقيقية الآن (تأكيد طلب، دفع، شراء منتج محدد)، أو "no" في غير ذلك.',
              },
              { role: "user", content: userMessage },
            ],
            max_tokens: 5,
          }),
        });
        if (intentRes.ok) {
          const intentData = await intentRes.json();
          const intent = (intentData.choices?.[0]?.message?.content || "").toLowerCase().trim();
          if (intent.includes("sale")) {
            const saleMsg = handover.sale_message || "سأقوم بتحويلك إلى موظف المبيعات.";
            await saveMessages(supabase, telegramUserId, chatbot.id, userMessage, saleMsg);
            if (handover.trigger_on_sale === true) {
              await createNotification("sale", "طلب شراء");
            }
            await fetch(telegramApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: saleMsg }),
            });
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.error("Sale intent failed:", e);
      }
    }

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
        } else if (item.type === "image" && item.file_url) {
          parts.push(
            `صورة بعنوان "${item.title}":\nالوصف: ${item.content || "بدون وصف"}\nرابط الإرسال: [IMAGE:${item.file_url}]`
          );
        }
      }
      knowledgeContext = parts.join("\n\n---\n\n");
      if (knowledgeItems.some((i) => i.type === "image" && i.file_url)) {
        knowledgeContext += `\n\n---\nملاحظة: عندما يطلب المستخدم رؤية صورة أو حين تكون الصورة هي أفضل إجابة، أرسلها بإضافة [IMAGE:<الرابط>] في ردك تماماً كما هو، ولا تخترع روابط.`;
      }
    }

    // Generate AI response with conversation history
    let responseText = await generateAIResponse(userMessage, knowledgeContext, chatbot, conversationHistory);

    // Unclear-question handover (consecutive fallback responses)
    if (handover?.enabled && responseText.trim() === chatbot.fallback_message.trim()) {
      const threshold = handover.failed_responses_threshold || 3;
      const { data: lastAssistant } = await supabase
        .from("telegram_messages")
        .select("content")
        .eq("chatbot_id", chatbot.id)
        .eq("telegram_user_id", telegramUserId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(threshold - 1);
      const fails =
        (lastAssistant || []).filter((m) => m.content.trim() === chatbot.fallback_message.trim()).length + 1;
      if (fails >= threshold) {
        responseText = handover.handover_message || "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
        await createNotification("unclear", "سؤال غير مفهوم");
      }
    }

    // Save messages
    await saveMessages(supabase, telegramUserId, chatbot.id, userMessage, responseText);

    // Parse [IMAGE:url] tokens and send images + remaining text
    const imageRegex = /\[IMAGE:(https?:\/\/[^\s\]]+)\]/g;
    const imageUrls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = imageRegex.exec(responseText)) !== null) imageUrls.push(m[1]);
    const cleanedText = responseText.replace(imageRegex, "").trim();
    const sendPhotoUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;

    for (let i = 0; i < imageUrls.length; i++) {
      // Attach caption only to the first image if there's no remaining text segments
      const caption = i === 0 && !cleanedText ? "" : "";
      const r = await fetch(sendPhotoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: imageUrls[i], caption }),
      });
      if (!r.ok) console.error("Telegram sendPhoto error:", await r.text());
    }

    if (cleanedText) {
      const r = await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: cleanedText }),
      });
      if (!r.ok) console.error("Telegram sendMessage error:", await r.text());
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
