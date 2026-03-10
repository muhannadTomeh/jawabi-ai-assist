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
    };
  }>;
}

interface MessengerWebhook {
  object: string;
  entry: MessengerEntry[];
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
      // Find channel with this verify token
      const { data: channel } = await supabase
        .from("channels")
        .select("*")
        .eq("platform", "messenger")
        .filter("config->verify_token", "eq", token)
        .maybeSingle();

      if (channel) {
        console.log("Webhook verified for channel:", channel.id);
        return new Response(challenge, {
          headers: { "Content-Type": "text/plain" },
        });
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
        // Fallback to legacy channels table
        const { data: channel } = await supabase
          .from("channels")
          .select("*, chatbots(*)")
          .eq("platform", "messenger")
          .eq("is_connected", true)
          .filter("config->page_id", "eq", pageId)
          .maybeSingle();

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

        const senderId = messaging.sender.id;
        const userMessage = messaging.message.text;

        // Generate response
        let responseText = chatbot.fallback_message;

        // Check knowledge base
        const { data: faqs } = await supabase
          .from("knowledge_items")
          .select("*")
          .eq("chatbot_id", chatbot.id)
          .eq("type", "faq");

        if (faqs && faqs.length > 0) {
          const matchedFaq = faqs.find(
            (faq) =>
              faq.question &&
              userMessage.toLowerCase().includes(faq.question.toLowerCase())
          );
          if (matchedFaq && matchedFaq.answer) {
            responseText = matchedFaq.answer;
          }
        }

        // Send response via Messenger API
        const messengerApiUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
        const messengerResponse = await fetch(messengerApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: responseText },
          }),
        });

        if (!messengerResponse.ok) {
          const errorData = await messengerResponse.text();
          console.error("Messenger API error:", errorData);
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
