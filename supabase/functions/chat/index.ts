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
    const { message, chatbot_id, conversation_history } = await req.json();

    if (!message || !chatbot_id) {
      return new Response(
        JSON.stringify({ error: "message and chatbot_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Build knowledge context
    let knowledgeContext = "";
    if (knowledgeItems && knowledgeItems.length > 0) {
      const faqItems = knowledgeItems
        .filter((item) => item.type === "faq" && item.question && item.answer)
        .map((item) => `سؤال: ${item.question}\nجواب: ${item.answer}`)
        .join("\n\n");

      const textItems = knowledgeItems
        .filter((item) => item.type === "text" && item.content)
        .map((item) => `${item.title}: ${item.content}`)
        .join("\n\n");

      if (faqItems) knowledgeContext += `\n## الأسئلة الشائعة:\n${faqItems}`;
      if (textItems) knowledgeContext += `\n## معلومات إضافية:\n${textItems}`;
    }

    // Build system prompt
    const toneMap: Record<string, string> = {
      professional: "احترافي ومهني",
      friendly: "ودود ولطيف",
      casual: "عفوي وبسيط",
      formal: "رسمي ومحترم",
    };

    const toneDesc = toneMap[chatbot.tone] || chatbot.tone;

    const systemPrompt = `أنت مساعد ذكي اسمك "${chatbot.name}". 
اللغة: ${chatbot.language}
اللهجة: ${chatbot.dialect}
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

    // Add conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        messages.push({
          role: msg.role === "bot" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Call Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      // Fallback to chatbot's fallback message
      return new Response(
        JSON.stringify({ response: chatbot.fallback_message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || chatbot.fallback_message;

    return new Response(
      JSON.stringify({ response: reply }),
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
