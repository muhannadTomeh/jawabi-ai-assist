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

function getSupabase() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

// Platform-specific Facebook Login scopes
const PLATFORM_SCOPES: Record<string, string> = {
  facebook: "pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement",
  instagram: "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement",
  whatsapp: "whatsapp_business_management,whatsapp_business_messaging,business_management",
};

// Get Facebook App ID
function handleGetAppId(): Response {
  return jsonResponse({ app_id: getEnv("FACEBOOK_APP_ID") });
}

// Get scopes for a platform
function handleGetScopes(platform: string): Response {
  const scopes = PLATFORM_SCOPES[platform];
  if (!scopes) return jsonResponse({ error: "Invalid platform" }, 400);
  return jsonResponse({ scopes });
}

// Exchange short-lived token for long-lived token
async function exchangeToken(userAccessToken: string): Promise<string> {
  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");

  const url =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${userAccessToken}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Token exchange failed");
  return data.access_token || userAccessToken;
}

// Get user's Facebook Pages
async function handleGetPages(body: any): Promise<Response> {
  const { user_access_token } = body;
  if (!user_access_token) return jsonResponse({ error: "Missing user_access_token" }, 400);

  try {
    const longLivedToken = await exchangeToken(user_access_token);

    const pagesUrl =
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts` +
      `?access_token=${longLivedToken}` +
      `&fields=id,name,access_token,picture`;

    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error || !pagesData.data) {
      return jsonResponse({ error: "فشل في جلب الصفحات" }, 400);
    }

    if (pagesData.data.length === 0) {
      return jsonResponse({ error: "لا توجد صفحات فيسبوك مرتبطة بحسابك" }, 400);
    }

    const pages = pagesData.data.map((p: any) => ({
      id: p.id,
      name: p.name,
      picture: p.picture?.data?.url || null,
      access_token: p.access_token,
    }));

    return jsonResponse({ pages, long_lived_token: longLivedToken });
  } catch (error) {
    console.error("Get pages error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "خطأ" }, 500);
  }
}

// Get Instagram Business accounts linked to pages
async function handleGetInstagramAccounts(body: any): Promise<Response> {
  const { user_access_token } = body;
  if (!user_access_token) return jsonResponse({ error: "Missing user_access_token" }, 400);

  try {
    const longLivedToken = await exchangeToken(user_access_token);

    // Get pages with instagram_business_account
    const pagesUrl =
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts` +
      `?access_token=${longLivedToken}` +
      `&fields=id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}`;

    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error || !pagesData.data) {
      return jsonResponse({ error: "فشل في جلب حسابات انستغرام" }, 400);
    }

    const accounts = pagesData.data
      .filter((p: any) => p.instagram_business_account)
      .map((p: any) => ({
        page_id: p.id,
        page_name: p.name,
        page_access_token: p.access_token,
        ig_id: p.instagram_business_account.id,
        ig_name: p.instagram_business_account.name || p.instagram_business_account.username,
        ig_username: p.instagram_business_account.username,
        ig_picture: p.instagram_business_account.profile_picture_url || null,
      }));

    if (accounts.length === 0) {
      return jsonResponse({ error: "لا توجد حسابات انستغرام بزنس مرتبطة بصفحاتك" }, 400);
    }

    return jsonResponse({ accounts, long_lived_token: longLivedToken });
  } catch (error) {
    console.error("Get IG accounts error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "خطأ" }, 500);
  }
}

// Get WhatsApp Business accounts
async function handleGetWhatsAppAccounts(body: any): Promise<Response> {
  const { user_access_token } = body;
  if (!user_access_token) return jsonResponse({ error: "Missing user_access_token" }, 400);

  try {
    const longLivedToken = await exchangeToken(user_access_token);

    // Get WhatsApp Business Accounts
    const url =
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/businesses` +
      `?access_token=${longLivedToken}` +
      `&fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error("WA business error:", data.error);
      return jsonResponse({ error: "فشل في جلب حسابات واتساب" }, 400);
    }

    const accounts: any[] = [];
    for (const biz of data.data || []) {
      const wabas = biz.owned_whatsapp_business_accounts?.data || [];
      for (const waba of wabas) {
        const phones = waba.phone_numbers?.data || [];
        for (const phone of phones) {
          accounts.push({
            waba_id: waba.id,
            waba_name: waba.name,
            phone_number_id: phone.id,
            display_phone: phone.display_phone_number,
            verified_name: phone.verified_name,
          });
        }
      }
    }

    if (accounts.length === 0) {
      return jsonResponse({ error: "لا توجد أرقام واتساب بزنس مرتبطة بحسابك" }, 400);
    }

    return jsonResponse({ accounts, long_lived_token: longLivedToken });
  } catch (error) {
    console.error("Get WA accounts error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "خطأ" }, 500);
  }
}

// Connect a Facebook Page (for Messenger)
async function handleConnectFacebook(body: any): Promise<Response> {
  const { chatbot_id, user_id, page_id, page_name, page_access_token } = body;
  if (!chatbot_id || !user_id || !page_id || !page_access_token) {
    return jsonResponse({ error: "بيانات ناقصة" }, 400);
  }

  const supabase = getSupabase();
  const supabaseUrl = getEnv("SUPABASE_URL");
  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");

  const verifyToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
    return jsonResponse({ error: "فشل في تسجيل التطبيق على الصفحة: " + (subscribeData.error.message || "") }, 400);
  }

  // Set up app webhook
  const appAccessToken = `${appId}|${appSecret}`;
  const webhookSubscribeUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions`;

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
  if (webhookData.error) console.error("Webhook subscribe error:", webhookData.error);

  // Calculate token expiry (~60 days for long-lived tokens)
  const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  // Save to social_connections
  const { error: upsertError } = await supabase
    .from("social_connections")
    .upsert({
      user_id,
      chatbot_id,
      platform: "facebook",
      page_id,
      page_name: page_name || "",
      access_token: page_access_token,
      token_expiry: tokenExpiry,
      metadata: { verify_token: verifyToken, webhook_url: webhookUrl },
    }, { onConflict: "chatbot_id,platform,page_id" });

  if (upsertError) {
    console.error("DB error:", upsertError);
    return jsonResponse({ error: "فشل في حفظ البيانات" }, 500);
  }

  // Also update channels table for backward compatibility
  const channelConfig = {
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
    await supabase.from("channels").update({ is_connected: true, config: channelConfig }).eq("id", existing.id);
  } else {
    await supabase.from("channels").insert({ chatbot_id, platform: "messenger", is_connected: true, config: channelConfig });
  }

  return jsonResponse({ success: true, page_name: page_name || "" });
}

// Connect Instagram Business Account
async function handleConnectInstagram(body: any): Promise<Response> {
  const { chatbot_id, user_id, page_id, page_name, page_access_token, ig_id, ig_name, ig_username } = body;
  if (!chatbot_id || !user_id || !ig_id || !page_access_token) {
    return jsonResponse({ error: "بيانات ناقصة" }, 400);
  }

  const supabase = getSupabase();
  const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("social_connections")
    .upsert({
      user_id,
      chatbot_id,
      platform: "instagram",
      page_id: ig_id,
      page_name: ig_name || ig_username || "",
      access_token: page_access_token,
      token_expiry: tokenExpiry,
      metadata: { ig_username, linked_page_id: page_id, linked_page_name: page_name },
    }, { onConflict: "chatbot_id,platform,page_id" });

  if (error) {
    console.error("DB error:", error);
    return jsonResponse({ error: "فشل في حفظ البيانات" }, 500);
  }

  return jsonResponse({ success: true, page_name: ig_name || ig_username || "" });
}

// Connect WhatsApp Business
async function handleConnectWhatsApp(body: any): Promise<Response> {
  const { chatbot_id, user_id, phone_number_id, display_phone, verified_name, waba_id, long_lived_token } = body;
  if (!chatbot_id || !user_id || !phone_number_id || !long_lived_token) {
    return jsonResponse({ error: "بيانات ناقصة" }, 400);
  }

  const supabase = getSupabase();
  const supabaseUrl = getEnv("SUPABASE_URL");
  const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const verifyToken = "jawabi_wa_" + Math.random().toString(36).substring(2, 15);
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const { error } = await supabase
    .from("social_connections")
    .upsert({
      user_id,
      chatbot_id,
      platform: "whatsapp",
      page_id: phone_number_id,
      page_name: verified_name || display_phone || "",
      access_token: long_lived_token,
      token_expiry: tokenExpiry,
      metadata: { waba_id, phone_number_id, display_phone, verify_token: verifyToken, webhook_url: webhookUrl },
    }, { onConflict: "chatbot_id,platform,page_id" });

  if (error) {
    console.error("DB error:", error);
    return jsonResponse({ error: "فشل في حفظ البيانات" }, 500);
  }

  // Also update channels table
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("chatbot_id", chatbot_id)
    .eq("platform", "whatsapp")
    .maybeSingle();

  const channelConfig = { phone_number_id, display_phone: display_phone || "", access_token: long_lived_token, verify_token: verifyToken };

  if (existing) {
    await supabase.from("channels").update({ is_connected: true, config: channelConfig }).eq("id", existing.id);
  } else {
    await supabase.from("channels").insert({ chatbot_id, platform: "whatsapp", is_connected: true, config: channelConfig });
  }

  return jsonResponse({ success: true, page_name: verified_name || display_phone || "", verify_token: verifyToken, webhook_url: webhookUrl });
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let action = url.searchParams.get("action");

  try {
    if (req.method === "GET") {
      if (action === "get-app-id") return handleGetAppId();
      if (action === "get-scopes") {
        const platform = url.searchParams.get("platform") || "facebook";
        return handleGetScopes(platform);
      }
    }

    if (req.method === "POST") {
      const body = await req.json();
      if (!action && body.action) action = body.action;

      switch (action) {
        case "get-pages": return await handleGetPages(body);
        case "get-instagram-accounts": return await handleGetInstagramAccounts(body);
        case "get-whatsapp-accounts": return await handleGetWhatsAppAccounts(body);
        case "connect-facebook": return await handleConnectFacebook(body);
        case "connect-page": return await handleConnectFacebook(body); // backward compat
        case "connect-instagram": return await handleConnectInstagram(body);
        case "connect-whatsapp": return await handleConnectWhatsApp(body);
        default: break;
      }
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "خطأ غير متوقع" }, 500);
  }
});
