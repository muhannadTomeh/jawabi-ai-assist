import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FACEBOOK_API_VERSION = "v21.0";

function getEnv(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// NEW: Get pages using short-lived user token from FB SDK
async function handleGetPages(req: Request): Promise<Response> {
  const { user_access_token } = await req.json();
  if (!user_access_token) {
    return jsonResponse({ error: "Missing user_access_token" }, 400);
  }

  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");

  // Exchange for long-lived token
  const longLivedUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${user_access_token}`;

  const longLivedRes = await fetch(longLivedUrl);
  const longLivedData = await longLivedRes.json();

  if (longLivedData.error) {
    console.error("Long-lived token error:", longLivedData.error);
    return jsonResponse({ error: "فشل في تبادل رمز الوصول" }, 400);
  }

  const longLivedToken = longLivedData.access_token || user_access_token;

  // Get user's pages
  const pagesUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts` +
    `?access_token=${longLivedToken}` +
    `&fields=id,name,access_token,picture`;

  const pagesRes = await fetch(pagesUrl);
  const pagesData = await pagesRes.json();

  if (pagesData.error || !pagesData.data) {
    console.error("Pages fetch error:", pagesData.error);
    return jsonResponse({ error: "فشل في جلب الصفحات" }, 400);
  }

  if (pagesData.data.length === 0) {
    return jsonResponse({ error: "لا توجد صفحات فيسبوك مرتبطة بحسابك" }, 400);
  }

  // Return pages (without exposing page access tokens to frontend)
  const pages = pagesData.data.map((p: any) => ({
    id: p.id,
    name: p.name,
    picture: p.picture?.data?.url || null,
    // Store access_token server-side only - encode in a temp map
    access_token: p.access_token,
  }));

  return jsonResponse({ pages });
}

// NEW: Connect a selected page
async function handleConnectPage(req: Request): Promise<Response> {
  const { chatbot_id, page_id, page_name, page_access_token } = await req.json();

  if (!chatbot_id || !page_id || !page_access_token) {
    return jsonResponse({ error: "بيانات ناقصة" }, 400);
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");

  const verifyToken =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  const webhookUrl = `${supabaseUrl}/functions/v1/messenger-webhook`;

  // Subscribe app to page
  const subscribeUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${page_id}/subscribed_apps` +
    `?access_token=${page_access_token}` +
    `&subscribed_fields=messages,messaging_postbacks`;

  const subscribeRes = await fetch(subscribeUrl, { method: "POST" });
  const subscribeData = await subscribeRes.json();

  if (subscribeData.error) {
    console.error("Subscribe error:", subscribeData.error);
    return jsonResponse({
      error: "فشل في تسجيل التطبيق على الصفحة: " + (subscribeData.error.message || ""),
    }, 400);
  }

  // Set up app webhook
  const appAccessToken = `${appId}|${appSecret}`;
  const webhookSubscribeUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions`;

  const webhookRes = await fetch(webhookSubscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: "page",
      callback_url: webhookUrl,
      verify_token: verifyToken,
      fields: "messages,messaging_postbacks",
      access_token: appAccessToken,
    }),
  });
  const webhookData = await webhookRes.json();

  if (webhookData.error) {
    console.error("Webhook subscribe error:", webhookData.error);
  }

  // Save to database
  const config = {
    page_id,
    page_name: page_name || "",
    page_access_token,
    verify_token: verifyToken,
    webhook_url: webhookUrl,
  };

  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("chatbot_id", chatbot_id)
    .eq("platform", "messenger")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("channels")
      .update({ is_connected: true, config })
      .eq("id", existing.id);
    if (error) {
      console.error("DB update error:", error);
      return jsonResponse({ error: "فشل في حفظ البيانات" }, 500);
    }
  } else {
    const { error } = await supabase.from("channels").insert({
      chatbot_id,
      platform: "messenger",
      is_connected: true,
      config,
    });
    if (error) {
      console.error("DB insert error:", error);
      return jsonResponse({ error: "فشل في حفظ البيانات" }, 500);
    }
  }

  return jsonResponse({ success: true, page_name: config.page_name });
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (req.method === "POST" && action === "get-pages") {
      return await handleGetPages(req);
    }

    if (req.method === "POST" && action === "connect-page") {
      return await handleConnectPage(req);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "خطأ غير متوقع" },
      500
    );
  }
});
