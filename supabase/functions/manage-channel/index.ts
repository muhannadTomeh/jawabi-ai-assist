import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Strip sensitive fields from channel config, returning only safe display data */
function sanitizeConfig(config: Record<string, unknown> | null): Record<string, string> | null {
  if (!config) return null;
  const safe: Record<string, string> = {};
  // Only expose non-sensitive fields
  if (config.bot_username) safe.bot_username = String(config.bot_username);
  if (config.page_id) safe.page_id = String(config.page_id);
  if (config.page_name) safe.page_name = String(config.page_name);
  if (config.webhook_url) safe.webhook_url = String(config.webhook_url);
  if (config.display_phone) safe.display_phone = String(config.display_phone);
  if (config.phone_number_id) safe.phone_number_id = String(config.phone_number_id);
  return Object.keys(safe).length > 0 ? safe : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate the user
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Create a client with the user's token to verify identity
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Service role client for data operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET: List channels (sanitized) for a chatbot
    if (req.method === "GET" && action === "list") {
      const chatbotId = url.searchParams.get("chatbot_id");
      if (!chatbotId) return jsonResponse({ error: "Missing chatbot_id" }, 400);

      // Verify ownership
      const { data: chatbot } = await supabase
        .from("chatbots")
        .select("id")
        .eq("id", chatbotId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!chatbot) return jsonResponse({ error: "Chatbot not found" }, 404);

      const { data: channels, error } = await supabase
        .from("channels")
        .select("*")
        .eq("chatbot_id", chatbotId);

      if (error) throw error;

      // Sanitize configs before returning
      const safeChannels = (channels || []).map((ch) => ({
        ...ch,
        config: sanitizeConfig(ch.config as Record<string, unknown> | null),
      }));

      return jsonResponse({ channels: safeChannels });
    }

    // POST: Disconnect a channel
    if (req.method === "POST" && action === "disconnect") {
      const body = await req.json();
      const channelId = body.channel_id;
      if (!channelId) return jsonResponse({ error: "Missing channel_id" }, 400);

      // Fetch channel with full config (server-side only)
      const { data: channel } = await supabase
        .from("channels")
        .select("*, chatbots(user_id)")
        .eq("id", channelId)
        .maybeSingle();

      if (!channel) return jsonResponse({ error: "Channel not found" }, 404);

      // Verify ownership
      if (channel.chatbots?.user_id !== user.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const config = channel.config as Record<string, string> | null;

      // Platform-specific cleanup
      if (channel.platform === "telegram" && config?.bot_token) {
        try {
          await fetch(
            `https://api.telegram.org/bot${config.bot_token}/deleteWebhook`
          );
        } catch (e) {
          console.error("Failed to delete Telegram webhook:", e);
        }
      }

      if (channel.platform === "messenger" && config?.page_access_token && config?.page_id) {
        try {
          // Unsubscribe app from page
          await fetch(
            `https://graph.facebook.com/v21.0/${config.page_id}/subscribed_apps?access_token=${config.page_access_token}`,
            { method: "DELETE" }
          );
        } catch (e) {
          console.error("Failed to unsubscribe Messenger:", e);
        }
      }

      // Clear config and mark disconnected
      const { error } = await supabase
        .from("channels")
        .update({ is_connected: false, config: null })
        .eq("id", channelId);

      if (error) throw error;

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("manage-channel error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
