import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MessengerEntry {
  id: string;
  time: number;
  messaging: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      is_echo?: boolean;
      app_id?: number;
    };
  }>;
}

interface MessengerWebhook {
  object: string;
  entry: MessengerEntry[];
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
  conversationHistory: { role: string; content: string }[],
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
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });
    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return chatbot.fallback_message;
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || chatbot.fallback_message;
  } catch (e) {
    console.error("AI call failed:", e);
    return chatbot.fallback_message;
  }
}

async function getOrCreateMessengerUser(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  messengerUserId: string
): Promise<{ isNew: boolean }> {
  const { data: existing } = await supabase
    .from("messenger_users")
    .select("id")
    .eq("chatbot_id", chatbotId)
    .eq("messenger_user_id", messengerUserId)
    .maybeSingle();
  if (existing) return { isNew: false };
  await supabase.from("messenger_users").insert({ chatbot_id: chatbotId, messenger_user_id: messengerUserId });
  return { isNew: true };
}

async function getMessengerHistory(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  messengerUserId: string
): Promise<{ role: string; content: string }[]> {
  const { data } = await supabase
    .from("messenger_messages")
    .select("role, content")
    .eq("chatbot_id", chatbotId)
    .eq("messenger_user_id", messengerUserId)
    .order("created_at", { ascending: true })
    .limit(10);
  return data || [];
}

async function saveMessengerMessages(
  supabase: ReturnType<typeof createClient>,
  chatbotId: string,
  messengerUserId: string,
  userMsg: string,
  assistantMsg: string
) {
  await supabase.from("messenger_messages").insert([
    { chatbot_id: chatbotId, messenger_user_id: messengerUserId, role: "user", content: userMsg },
    { chatbot_id: chatbotId, messenger_user_id: messengerUserId, role: "assistant", content: assistantMsg },
  ]);
  const { data: allMsgs } = await supabase
    .from("messenger_messages")
    .select("id, created_at")
    .eq("chatbot_id", chatbotId)
    .eq("messenger_user_id", messengerUserId)
    .order("created_at", { ascending: false });
  if (allMsgs && allMsgs.length > 10) {
    const idsToDelete = allMsgs.slice(10).map((m) => m.id);
    await supabase.from("messenger_messages").delete().in("id", idsToDelete);
  }
}

async function sendMessengerText(pageAccessToken: string, recipientId: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  if (!r.ok) console.error("Messenger sendText error:", await r.text());
}

async function sendMessengerImage(pageAccessToken: string, recipientId: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
    }),
  });
  if (!r.ok) console.error("Messenger sendImage error:", await r.text());
}

async function sendMessengerTypingOn(pageAccessToken: string, recipientId: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, sender_action: "typing_on" }),
    });
    if (!r.ok) console.error("Messenger typing_on error:", await r.text());
  } catch (e) {
    console.error("Messenger typing_on failed:", e);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);

  // Handle webhook verification (GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      // Check social_connections metadata for verify_token
      const { data: socialConns } = await supabase
        .from("social_connections")
        .select("id, metadata")
        .eq("platform", "facebook");

      const socialConn = socialConns?.find(
        (c: any) => c.metadata?.verify_token === token
      );

      if (socialConn) {
        console.log("Webhook verified via social_connections:", socialConn.id);
        return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
      }

      // Fallback to legacy channels
      const { data: channels } = await supabase
        .from("channels")
        .select("*")
        .eq("platform", "messenger")
        .eq("is_connected", true);

      const channel = channels?.find(
        (c: any) => c.config?.verify_token === token
      );

      if (channel) {
        console.log("Webhook verified for channel:", channel.id);
        return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
      }
    }

    return new Response("Forbidden", { status: 403 });
  }

  // Handle incoming messages (POST request)
  try {
    const body: MessengerWebhook = await req.json();
    console.log("Received Messenger webhook:", JSON.stringify(body));

    if (body.object !== "page") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const entry of body.entry) {
      const pageId = entry.id;

      // Try social_connections first, fall back to channels
      let chatbot: any = null;
      let pageAccessToken: string | null = null;

      const { data: socialConn } = await supabase
        .from("social_connections")
        .select("*, chatbots(*)")
        .eq("platform", "facebook")
        .eq("page_id", pageId)
        .maybeSingle();

      if (socialConn) {
        chatbot = socialConn.chatbots;
        pageAccessToken = socialConn.access_token;
      } else {
        // Fallback to legacy channels table (filter JSONB in JS)
        const { data: legacyChannels } = await supabase
          .from("channels")
          .select("*, chatbots(*)")
          .eq("platform", "messenger")
          .eq("is_connected", true);

        const channel = legacyChannels?.find(
          (c: any) => c.config?.page_id === pageId
        );

        if (channel) {
          chatbot = channel.chatbots;
          pageAccessToken = channel.config?.page_access_token;
        }
      }

      if (!chatbot || !pageAccessToken) {
        console.log("No connection found for page:", pageId);
        continue;
      }

      for (const messaging of entry.messaging) {
        if (!messaging.message?.text) continue;

        // Echo events represent messages the Page itself sent (from Inbox,
        // dashboard, or another tool). Use them to flag human takeover, then skip.
        if (messaging.message.is_echo) {
          const recipientId = messaging.recipient?.id;
          // Ignore echoes we produced ourselves (app_id belongs to our app)
          // by checking if there is no matching app_id filter — we mark takeover
          // only when the echo comes from a *different* app (Page Inbox / human).
          const ourAppId = messaging.message.app_id;
          const looksLikeHuman = !ourAppId || ourAppId === 0;
          if (recipientId && looksLikeHuman) {
            await supabase.from("conversation_takeovers").upsert(
              {
                chatbot_id: chatbot.id,
                channel: "facebook",
                external_id: recipientId,
                active: true,
                last_human_at: new Date().toISOString(),
                source: "messenger_echo",
              },
              { onConflict: "chatbot_id,channel,external_id" }
            );
            console.log("Human takeover flagged via echo for", recipientId);
          }
          continue;
        }

        const senderId = messaging.sender.id;
        const userMessage = messaging.message.text;

        // Serialize concurrent messages from the same sender+chatbot.
        let lockAcquired = false;
        const releaseLock = async () => {
          if (!lockAcquired) return;
          lockAcquired = false;
          try {
            await supabase.rpc("release_conversation_lock", {
              p_chatbot_id: chatbot.id,
              p_external_id: senderId,
            });
          } catch (e) {
            console.error("release_conversation_lock failed:", e);
          }
        };
        try {
          const { data: gotLock } = await supabase.rpc("acquire_conversation_lock", {
            p_chatbot_id: chatbot.id,
            p_external_id: senderId,
          });
          lockAcquired = gotLock !== false;
        } catch (e) {
          console.error("acquire_conversation_lock failed:", e);
        }

        try {

        // Record customer profile
        await supabase.rpc("record_customer_contact", {
          _chatbot_id: chatbot.id,
          _channel: "facebook",
          _external_id: senderId,
          _name: null,
          _username: null,
          _phone: null,
          _last_message: userMessage,
        });

        // Track new vs existing user, send welcome on first contact
        const { isNew } = await getOrCreateMessengerUser(supabase, chatbot.id, senderId);
        if (isNew) {
          const welcomeMsg = chatbot.welcome_message || `مرحباً! أنا ${chatbot.name}. كيف يمكنني مساعدتك؟`;
          await sendMessengerText(pageAccessToken, senderId, welcomeMsg);
        }

        // Conversation history
        const conversationHistory = await getMessengerHistory(supabase, chatbot.id, senderId);

        // Handover settings
        const { data: handover } = await supabase
          .from("handover_settings")
          .select("*")
          .eq("chatbot_id", chatbot.id)
          .maybeSingle();

        // Human takeover check
        if (handover?.takeover_mode_enabled) {
          const { data: takeover } = await supabase
            .from("conversation_takeovers")
            .select("active,last_human_at")
            .eq("chatbot_id", chatbot.id)
            .eq("channel", "facebook")
            .eq("external_id", senderId)
            .maybeSingle();
          if (takeover?.active) {
            const timeoutMin = handover.takeover_timeout_minutes || 60;
            const lastHuman = new Date(takeover.last_human_at as string).getTime();
            if (Date.now() - lastHuman < timeoutMin * 60 * 1000) {
              await supabase.from("messenger_messages").insert({
                chatbot_id: chatbot.id,
                messenger_user_id: senderId,
                role: "user",
                content: userMessage,
              });
              console.log("Skipping Messenger reply: human takeover active for", senderId);
              continue;
            } else {
              await supabase
                .from("conversation_takeovers")
                .update({ active: false })
                .eq("chatbot_id", chatbot.id)
                .eq("channel", "facebook")
                .eq("external_id", senderId);
            }
          }
        }

        const createNotification = async (type: string, title: string) => {
          await supabase.from("notifications").insert({
            chatbot_id: chatbot.id,
            type,
            title,
            channel: "facebook",
            contact_identifier: senderId,
            contact_name: null,
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
            const handoverMsg = handover.handover_message || "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
            await saveMessengerMessages(supabase, chatbot.id, senderId, userMessage, handoverMsg);
            await createNotification("human_request", "طلب التحدث مع موظف");
            await sendMessengerText(pageAccessToken, senderId, handoverMsg);
            continue;
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
                  { role: "system", content: 'صنّف الرسالة. أجب فقط بكلمة واحدة: "sale" إذا كان الزبون يريد إجراء عملية شراء حقيقية الآن، أو "no" في غير ذلك.' },
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
                await saveMessengerMessages(supabase, chatbot.id, senderId, userMessage, saleMsg);
                if (handover.trigger_on_sale === true) {
                  await createNotification("sale", "طلب شراء");
                }
                await sendMessengerText(pageAccessToken, senderId, saleMsg);
                continue;
              }
            }
          } catch (e) {
            console.error("Sale intent failed:", e);
          }
        }

        // Build knowledge context
        const { data: allKnowledgeItems } = await supabase
          .from("knowledge_items")
          .select("*")
          .eq("chatbot_id", chatbot.id);

        // Semantic retrieval with fallback to the full dump.
        let retrievedItems: any[] | null = null;
        try {
          const embRes = await supabase.functions.invoke("generate-embedding", {
            body: { text: userMessage },
          });
          const embedding = (embRes.data as any)?.embedding;
          if (Array.isArray(embedding)) {
            const { data: matches } = await supabase.rpc("match_knowledge_items", {
              p_chatbot_id: chatbot.id,
              query_embedding: embedding,
              match_count: 5,
            });
            if (matches && matches.length > 0) retrievedItems = matches as any[];
          }
        } catch (e) {
          console.error("Semantic retrieval failed, falling back:", e);
        }
        const knowledgeItems = retrievedItems ?? allKnowledgeItems;

        let knowledgeContext = "";
        if (knowledgeItems && knowledgeItems.length > 0) {
          const parts: string[] = [];
          for (const item of knowledgeItems) {
            if (item.type === "faq" && item.question && item.answer) {
              parts.push(`سؤال: ${item.question}\nجواب: ${item.answer}`);
            } else if ((item.type === "text" || item.type === "url" || item.type === "social") && item.content) {
              parts.push(`${item.title}:\n${item.content}`);
            } else if (item.type === "file" && item.content) {
              parts.push(`ملف "${item.title}":\n${item.content}`);
            } else if (item.type === "image" && item.file_url) {
              parts.push(`صورة بعنوان "${item.title}":\nالوصف: ${item.content || "بدون وصف"}\nرابط الإرسال: [IMAGE:${item.file_url}]`);
            }
          }
          knowledgeContext = parts.join("\n\n---\n\n");
          if (knowledgeItems.some((i) => i.type === "image" && i.file_url)) {
            knowledgeContext += `\n\n---\nملاحظة: عندما يطلب المستخدم رؤية صورة أو حين تكون الصورة هي أفضل إجابة، أرسلها بإضافة [IMAGE:<الرابط>] في ردك تماماً كما هو، ولا تخترع روابط.`;
          }
        }

        // Generate AI response
        // Typing indicator for a more human feel.
        await sendMessengerTypingOn(pageAccessToken, senderId);
        let responseText = await generateAIResponse(userMessage, knowledgeContext, chatbot, conversationHistory, supabase);

        // Failed-responses handover
        if (handover?.enabled && responseText.trim() === (chatbot.fallback_message || "").trim()) {
          const threshold = handover.failed_responses_threshold || 3;
          const { data: lastAssistant } = await supabase
            .from("messenger_messages")
            .select("content")
            .eq("chatbot_id", chatbot.id)
            .eq("messenger_user_id", senderId)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(threshold - 1);
          const fails = (lastAssistant || []).filter((m) => m.content.trim() === chatbot.fallback_message.trim()).length + 1;
          if (fails >= threshold) {
            responseText = handover.handover_message || "سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة.";
            await createNotification("unclear", "سؤال غير مفهوم");
          }
        }

        // Save messages
        await saveMessengerMessages(supabase, chatbot.id, senderId, userMessage, responseText);

        // Extract [IMAGE:url] tokens
        const imageRegex = /\[IMAGE:(https?:\/\/[^\s\]]+)\]/g;
        const imageUrls: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = imageRegex.exec(responseText)) !== null) imageUrls.push(m[1]);
        const cleanedText = responseText.replace(imageRegex, "").trim();

        for (const imgUrl of imageUrls) {
          await sendMessengerImage(pageAccessToken, senderId, imgUrl);
        }
        if (cleanedText) {
          await sendMessengerText(pageAccessToken, senderId, cleanedText);
        }
        } finally {
          await releaseLock();
        }
      }
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
