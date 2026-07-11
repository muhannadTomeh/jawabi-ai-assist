import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  type: string;
}

interface WhatsAppWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

async function upsertContact(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  phoneNumber: string,
  name?: string
) {
  await supabase.from("whatsapp_contacts").upsert(
    {
      chatbot_id: chatbotId,
      phone_number: phoneNumber,
      ...(name ? { name } : {}),
      last_message_at: new Date().toISOString(),
    },
    { onConflict: "chatbot_id,phone_number", ignoreDuplicates: false }
  );
}

async function saveMessages(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  phoneNumber: string,
  userMessage: string,
  botReply: string
) {
  await supabase.from("whatsapp_messages").insert([
    { chatbot_id: chatbotId, phone_number: phoneNumber, role: "user", content: userMessage },
    { chatbot_id: chatbotId, phone_number: phoneNumber, role: "assistant", content: botReply },
  ]);
}

async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  phoneNumber: string,
  limit = 10
): Promise<{ role: string; content: string }[]> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("role, content")
    .eq("chatbot_id", chatbotId)
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data.reverse(); // oldest first
}

async function generateAIResponse(
  userMessage: string,
  knowledgeContext: string,
  chatbot: { name: string; tone: string; language: string; fallback_message: string; custom_instructions: string; dialect: string },
  conversationHistory: { role: string; content: string }[],
  senderName: string | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  // Unified LLM config from admin panel (single source of truth)
  const { data: llmCfg } = await supabase
    .from("llm_settings")
    .select("model, custom_api_key")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const model = (llmCfg as any)?.model || "google/gemini-2.5-flash";
  const apiKey = (llmCfg as any)?.custom_api_key || Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("No AI API key configured, using fallback");
    return chatbot.fallback_message;
  }

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

  const customInstructions = chatbot.custom_instructions
    ? `\n\nتعليمات إضافية:\n${chatbot.custom_instructions}`
    : "";

  const senderInfo = senderName
    ? `\n\nاسم المرسل الحالي: ${senderName}. يمكنك مخاطبته باسمه بشكل طبيعي.`
    : "";

  const systemPrompt = `أنت مساعد ذكي اسمك "${chatbot.name}". تتحدث ${chatbot.language} بنبرة ${toneMap[chatbot.tone] || chatbot.tone} وبـ${dialectMap[chatbot.dialect] || "العربية الفصحى"}.${senderInfo}${customInstructions}

${knowledgeContext ? `قاعدة المعرفة:\n${knowledgeContext}` : ""}

إذا لم تجد إجابة في قاعدة المعرفة، استخدم: "${chatbot.fallback_message}"
أجب بإيجاز ووضوح. لا تكرر التحية في كل رد.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return chatbot.fallback_message;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || chatbot.fallback_message;
  } catch (error) {
    console.error("AI generation error:", error);
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

  const url = new URL(req.url);

  // Webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      const { data: channels } = await supabase
        .from("channels")
        .select("*")
        .eq("platform", "whatsapp");

      const channel = channels?.find(
        (c: any) => c.config?.verify_token === token
      );

      if (channel) {
        console.log("WhatsApp webhook verified for channel:", channel.id);
        return new Response(challenge, {
          headers: { "Content-Type": "text/plain" },
        });
      }
    }

    return new Response("Forbidden", { status: 403 });
  }

  // Handle incoming messages (POST)
  try {
    const body: WhatsAppWebhook = await req.json();
    console.log("Received WhatsApp webhook:", JSON.stringify(body));

    if (body.object !== "whatsapp_business_account") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        // Find channel for this phone number ID
        const { data: channel } = await supabase
          .from("channels")
          .select("*, chatbots(*)")
          .eq("platform", "whatsapp")
          .eq("is_connected", true)
          .filter("config->phone_number_id", "eq", phoneNumberId)
          .maybeSingle();

        if (!channel) {
          console.log("No channel found for phone_number_id:", phoneNumberId);
          continue;
        }

        const chatbot = channel.chatbots;
        const accessToken = channel.config?.access_token;

        if (!value.messages) continue;

        // Build a map of contact names from the contacts array
        const contactNames: Record<string, string> = {};
        if (value.contacts) {
          for (const c of value.contacts) {
            contactNames[c.wa_id] = c.profile.name;
          }
        }

        // Build knowledge context once for all messages
        const { data: knowledgeItems } = await supabase
          .from("knowledge_items")
          .select("*")
          .eq("chatbot_id", chatbot.id);

        let knowledgeContext = "";
        if (knowledgeItems && knowledgeItems.length > 0) {
          const faqs = knowledgeItems
            .filter((i) => i.type === "faq" && i.question && i.answer)
            .map((i) => `سؤال: ${i.question}\nجواب: ${i.answer}`)
            .join("\n\n");
          const texts = knowledgeItems
            .filter((i) => i.type === "text" && i.content)
            .map((i) => `${i.title}: ${i.content}`)
            .join("\n\n");
          const images = knowledgeItems
            .filter((i) => i.type === "image" && i.file_url)
            .map(
              (i) =>
                `صورة بعنوان "${i.title}":\nالوصف: ${i.content || "بدون وصف"}\nرابط الإرسال: [IMAGE:${i.file_url}]`
            )
            .join("\n\n");
          if (faqs) knowledgeContext += faqs + "\n\n";
          if (texts) knowledgeContext += texts;
          if (images) {
            knowledgeContext += `\n\n## الصور المتاحة:\n${images}\n\nعندما يطلب المستخدم رؤية صورة أو حين تكون الصورة هي أفضل إجابة، أرسلها بإضافة [IMAGE:<الرابط>] في ردك تماماً كما هي، ولا تخترع روابط.`;
          }
        }

        for (const message of value.messages) {
          if (message.type !== "text" || !message.text?.body) continue;

          const senderPhone = message.from;
          const userMessage = message.text.body;
          const senderName = contactNames[senderPhone];

          // Upsert contact (save/update name and last message time)
          await upsertContact(supabase, chatbot.id, senderPhone, senderName);

          // Record customer profile
          await supabase.rpc("record_customer_contact", {
            _chatbot_id: chatbot.id,
            _channel: "whatsapp",
            _external_id: senderPhone,
            _name: senderName || null,
            _username: null,
            _phone: senderPhone,
            _last_message: userMessage,
          });

          // Get conversation history for this sender
          const history = await getConversationHistory(supabase, chatbot.id, senderPhone, 10);

          // Generate AI response with history and sender name
          const responseText = await generateAIResponse(
            userMessage,
            knowledgeContext,
            chatbot,
            history,
            senderName
          );

          // Save messages to database
          await saveMessages(supabase, chatbot.id, senderPhone, userMessage, responseText);

          // Parse [IMAGE:url] tokens and send images + remaining text
          const imageRegex = /\[IMAGE:(https?:\/\/[^\s\]]+)\]/g;
          const imageUrls: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = imageRegex.exec(responseText)) !== null) imageUrls.push(m[1]);
          const cleanedText = responseText.replace(imageRegex, "").trim();
          const waApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

          for (const imgUrl of imageUrls) {
            const r = await fetch(waApiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: senderPhone,
                type: "image",
                image: { link: imgUrl },
              }),
            });
            if (!r.ok) console.error("WhatsApp image send error:", await r.text());
          }

          if (cleanedText) {
            const r = await fetch(waApiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: senderPhone,
                type: "text",
                text: { body: cleanedText },
              }),
            });
            if (!r.ok) console.error("WhatsApp text send error:", await r.text());
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
