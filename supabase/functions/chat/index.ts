import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, chatbot_id: chatbotIdIn, public_slug, conversation_history, user_id } = await req.json();

    if (!message || (!chatbotIdIn && !public_slug)) {
      return new Response(
        JSON.stringify({ error: "message and chatbot_id or public_slug are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let chatbot_id = chatbotIdIn as string | undefined;
    if (!chatbot_id && public_slug) {
      const { data: bySlug } = await supabase
        .from("chatbots")
        .select("id")
        .eq("public_slug", public_slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!bySlug) {
        return new Response(
          JSON.stringify({ error: "Chatbot not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      chatbot_id = bySlug.id;
    }

    // Record customer profile for web channel (if identifiable)
    if (user_id) {
      await supabase.rpc("record_customer_contact", {
        _chatbot_id: chatbot_id,
        _channel: "web",
        _external_id: user_id,
        _name: null,
        _username: null,
        _phone: null,
        _last_message: message,
      });
    }

    // Fetch chatbot settings
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("*")
      .eq("id", chatbot_id)
      .single();

    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: "Chatbot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch knowledge base items
    const { data: knowledgeItems } = await supabase
      .from("knowledge_items")
      .select("*")
      .eq("chatbot_id", chatbot_id);

    // Fetch handover settings
    const { data: handover } = await supabase
      .from("handover_settings")
      .select("*")
      .eq("chatbot_id", chatbot_id)
      .maybeSingle();

    // Check keyword-based handover trigger
    if (handover?.enabled && Array.isArray(handover.trigger_keywords)) {
      const lower = message.toLowerCase();
      const triggered = handover.trigger_keywords.some(
        (kw: string) => kw && lower.includes(kw.toLowerCase())
      );
      if (triggered) {
        const handoverMsg = handover.handover_message ||
          "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
        if (user_id) {
          await supabase.from("web_chat_messages").insert([
            { chatbot_id, user_id, role: "user", content: message },
            { chatbot_id, user_id, role: "assistant", content: handoverMsg },
          ]);
        }
        await supabase.from("notifications").insert({
          chatbot_id,
          type: "human_request",
          title: "طلب التحدث مع موظف",
          channel: "web",
          contact_identifier: user_id || "anonymous",
          last_message: message,
        });
        return new Response(
          JSON.stringify({ response: handoverMsg, handover: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Detect sale intent via AI classifier — gated by chatbot.bot_mode
    const botMode: string = (chatbot as any).bot_mode || "inquiries_sales";
    const salesEnabled = botMode === "inquiries_sales" || botMode === "inquiries_sales_followup";
    if (handover?.enabled && salesEnabled) {
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
                  'صنّف الرسالة التالية. أجب فقط بكلمة واحدة: "sale" إذا كان الزبون يريد إجراء عملية شراء حقيقية الآن (تأكيد طلب، دفع، شراء منتج محدد بنية واضحة)، أو "no" في غير ذلك (سؤال عن السعر، استفسار عام، تصفح).',
              },
              { role: "user", content: message },
            ],
            max_tokens: 5,
          }),
        });
        if (intentRes.ok) {
          const intentData = await intentRes.json();
          const intent = (intentData.choices?.[0]?.message?.content || "").toLowerCase().trim();
          if (intent.includes("sale")) {
            const saleMsg = handover.sale_message || "سأقوم بتحويلك إلى موظف المبيعات.";
            if (user_id) {
              await supabase.from("web_chat_messages").insert([
                { chatbot_id, user_id, role: "user", content: message },
                { chatbot_id, user_id, role: "assistant", content: saleMsg },
              ]);
            }
            if (handover.trigger_on_sale === true) {
              await supabase.from("notifications").insert({
                chatbot_id,
                type: "sale",
                title: "طلب شراء",
                channel: "web",
                contact_identifier: user_id || "anonymous",
                last_message: message,
              });
            }
            return new Response(
              JSON.stringify({ response: saleMsg, handover: handover.trigger_on_sale === true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.error("Sale intent detection failed:", e);
      }
    }

    // Build knowledge context
    let knowledgeContext = "";
    if (knowledgeItems && knowledgeItems.length > 0) {
      const faqItems = knowledgeItems
        .filter((item) => item.type === "faq" && item.question && item.answer)
        .map((item) => `سؤال: ${item.question}\nجواب: ${item.answer}`)
        .join("\n\n");

      const textItems = knowledgeItems
        .filter((item) => (item.type === "text" || item.type === "url" || item.type === "social") && item.content)
        .map((item) => (item.type === "url" || item.type === "social") && item.file_url
          ? `${item.title} (المصدر: ${item.file_url}):\n${item.content}`
          : `${item.title}: ${item.content}`)
        .join("\n\n");

      const imageItems = knowledgeItems
        .filter((item) => item.type === "image" && item.file_url)
        .map(
          (item) =>
            `صورة بعنوان "${item.title}":\nالوصف: ${item.content || "بدون وصف"}\nرابط الإرسال: [IMAGE:${item.file_url}]`
        )
        .join("\n\n");

      if (faqItems) knowledgeContext += `\n## الأسئلة الشائعة:\n${faqItems}`;
      if (textItems) knowledgeContext += `\n## معلومات إضافية:\n${textItems}`;
      if (imageItems) {
        knowledgeContext += `\n## الصور المتاحة:\n${imageItems}\n\nملاحظة: عندما يطلب المستخدم رؤية صورة أو حين تكون الصورة هي أفضل إجابة (قائمة أسعار، كتالوج، خريطة...)، أرسلها بإضافة [IMAGE:<الرابط>] في ردك تماماً كما هي. يمكنك إرسال أكثر من صورة. لا تخترع روابط ولا تستخدم سوى الروابط الموجودة أعلاه.`;
      }
    }

    // Fetch stored history from DB if user_id provided (for persistent memory)
    let dbHistory: { role: string; content: string }[] = [];
    if (user_id) {
      const { data: storedMessages } = await supabase
        .from("web_chat_messages")
        .select("role, content")
        .eq("chatbot_id", chatbot_id)
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (storedMessages && storedMessages.length > 0) {
        dbHistory = storedMessages.reverse();
      }
    }

    // Merge DB history with any additional conversation_history from client
    const mergedHistory = dbHistory.length > 0 ? dbHistory : (conversation_history || []);

    // Build system prompt
    const toneMap: Record<string, string> = {
      professional: "احترافي ومهني",
      friendly: "ودود ولطيف",
      casual: "عفوي وبسيط",
      formal: "رسمي ومحترم",
    };

    const dialectMap: Record<string, string> = {
      palestinian: "اللهجة الفلسطينية العامية",
      formal: "العربية الفصحى",
    };

    const toneDesc = toneMap[chatbot.tone] || chatbot.tone;
    const dialectDesc = dialectMap[chatbot.dialect] || "العربية الفصحى";

    const systemPrompt = `أنت مساعد ذكي اسمك "${chatbot.name}". 
اللغة: ${chatbot.language}
اللهجة: ${dialectDesc}
النبرة: ${toneDesc}

${chatbot.custom_instructions ? `تعليمات خاصة: ${chatbot.custom_instructions}` : ""}

رسالة الترحيب: ${chatbot.welcome_message}

إذا لم تتمكن من الإجابة على سؤال المستخدم من قاعدة المعرفة المتاحة، استخدم هذه الرسالة: "${chatbot.fallback_message}"

${knowledgeContext ? `\n# قاعدة المعرفة المتاحة:\n${knowledgeContext}` : "ليس لديك قاعدة معرفة حالياً. أجب بشكل عام ومفيد."}

أجب بإيجاز ووضوح. استخدم المعلومات من قاعدة المعرفة عند الإمكان.`;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add merged conversation history
    for (const msg of mergedHistory) {
      messages.push({
        role: msg.role === "bot" ? "assistant" : msg.role === "user" ? "user" : msg.role,
        content: msg.content,
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Resolve model + API key (admin-configurable via llm_settings)
    const { data: llmCfg } = await supabase
      .from("llm_settings")
      .select("model, custom_api_key")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const model = llmCfg?.model || "google/gemini-2.5-flash";
    const apiKey = llmCfg?.custom_api_key || Deno.env.get("LOVABLE_API_KEY");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ response: chatbot.fallback_message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || chatbot.fallback_message;

    // Failed-responses handover: if reply is the fallback message, count consecutive failures
    let finalReply = reply;
    let didHandover = false;
    if (handover?.enabled && user_id && reply.trim() === chatbot.fallback_message.trim()) {
      const threshold = handover.failed_responses_threshold || 3;
      const { data: lastAssistant } = await supabase
        .from("web_chat_messages")
        .select("content")
        .eq("chatbot_id", chatbot_id)
        .eq("user_id", user_id)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(threshold - 1);
      const consecutiveFails =
        (lastAssistant || []).filter((m) => m.content.trim() === chatbot.fallback_message.trim()).length + 1;
      if (consecutiveFails >= threshold) {
        finalReply = handover.handover_message || "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
        didHandover = true;
        await supabase.from("notifications").insert({
          chatbot_id,
          type: "unclear",
          title: "سؤال غير مفهوم",
          channel: "web",
          contact_identifier: user_id,
          last_message: message,
        });
      }
    }

    // Save user message + bot reply to DB if user_id provided
    if (user_id) {
      await supabase.from("web_chat_messages").insert([
        { chatbot_id, user_id, role: "user", content: message },
        { chatbot_id, user_id, role: "assistant", content: finalReply },
      ]);
    }

    return new Response(
      JSON.stringify({ response: finalReply, handover: didHandover }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
