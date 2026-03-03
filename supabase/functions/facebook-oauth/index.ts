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

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Step 1: Redirect user to Facebook OAuth
function handleAuth(req: Request): Response {
  const url = new URL(req.url);
  const chatbotId = url.searchParams.get("chatbot_id");
  if (!chatbotId) return jsonResponse({ error: "Missing chatbot_id" }, 400);

  const appId = getEnv("FACEBOOK_APP_ID");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const redirectUri = `${supabaseUrl}/functions/v1/facebook-oauth?action=callback`;

  const scopes = [
    "pages_messaging",
    "pages_show_list",
    "pages_manage_metadata",
    "pages_read_engagement",
  ].join(",");

  const state = chatbotId;

  const fbAuthUrl =
    `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&state=${state}` +
    `&response_type=code`;

  return Response.redirect(fbAuthUrl, 302);
}

// Step 2: Handle Facebook callback, exchange code, show page selector
async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const chatbotId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return htmlResponse(errorPage("تم إلغاء تسجيل الدخول من فيسبوك"));
  }

  if (!code || !chatbotId) {
    return htmlResponse(errorPage("بيانات غير صحيحة"), 400);
  }

  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const redirectUri = `${supabaseUrl}/functions/v1/facebook-oauth?action=callback`;

  // Exchange code for user access token
  const tokenUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`;

  const tokenRes = await fetch(tokenUrl);
  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    console.error("Token exchange error:", tokenData.error);
    return htmlResponse(errorPage("فشل في الحصول على رمز الوصول"));
  }

  const userAccessToken = tokenData.access_token;

  // Get long-lived token
  const longLivedUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${userAccessToken}`;

  const longLivedRes = await fetch(longLivedUrl);
  const longLivedData = await longLivedRes.json();
  const longLivedToken = longLivedData.access_token || userAccessToken;

  // Get user's pages
  const pagesUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts` +
    `?access_token=${longLivedToken}` +
    `&fields=id,name,access_token,picture`;

  const pagesRes = await fetch(pagesUrl);
  const pagesData = await pagesRes.json();

  if (pagesData.error || !pagesData.data) {
    console.error("Pages fetch error:", pagesData.error);
    return htmlResponse(errorPage("فشل في جلب الصفحات"));
  }

  if (pagesData.data.length === 0) {
    return htmlResponse(errorPage("لا توجد صفحات فيسبوك مرتبطة بحسابك"));
  }

  // Show page selector
  return htmlResponse(pageSelector(pagesData.data, chatbotId));
}

// Step 3: User selected a page — save config and subscribe webhook
async function handleSelectPage(req: Request): Promise<Response> {
  const formData = await req.formData();
  const pageId = formData.get("page_id") as string;
  const pageName = formData.get("page_name") as string;
  const pageAccessToken = formData.get("page_access_token") as string;
  const chatbotId = formData.get("chatbot_id") as string;

  if (!pageId || !pageAccessToken || !chatbotId) {
    return htmlResponse(errorPage("بيانات ناقصة"), 400);
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const appId = getEnv("FACEBOOK_APP_ID");
  const appSecret = getEnv("FACEBOOK_APP_SECRET");

  // Generate verify token
  const verifyToken =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  const webhookUrl = `${supabaseUrl}/functions/v1/messenger-webhook`;

  // Subscribe app to page
  const subscribeUrl =
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/subscribed_apps` +
    `?access_token=${pageAccessToken}` +
    `&subscribed_fields=messages,messaging_postbacks`;

  const subscribeRes = await fetch(subscribeUrl, { method: "POST" });
  const subscribeData = await subscribeRes.json();

  if (subscribeData.error) {
    console.error("Subscribe error:", subscribeData.error);
    return htmlResponse(
      errorPage("فشل في تسجيل التطبيق على الصفحة: " + (subscribeData.error.message || ""))
    );
  }

  // Set up app webhook (requires app-level access token)
  const appAccessToken = `${appId}|${appSecret}`;

  // Subscribe webhook for the app
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
    // Continue anyway — user can set up webhook manually if needed
  }

  // Save to database
  const config = {
    page_id: pageId,
    page_name: pageName,
    page_access_token: pageAccessToken,
    verify_token: verifyToken,
    webhook_url: webhookUrl,
  };

  // Check if channel already exists
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("chatbot_id", chatbotId)
    .eq("platform", "messenger")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("channels")
      .update({ is_connected: true, config })
      .eq("id", existing.id);
    if (error) {
      console.error("DB update error:", error);
      return htmlResponse(errorPage("فشل في حفظ البيانات"));
    }
  } else {
    const { error } = await supabase.from("channels").insert({
      chatbot_id: chatbotId,
      platform: "messenger",
      is_connected: true,
      config,
    });
    if (error) {
      console.error("DB insert error:", error);
      return htmlResponse(errorPage("فشل في حفظ البيانات"));
    }
  }

  return htmlResponse(successPage(pageName));
}

// HTML Templates
function pageSelector(
  pages: Array<{ id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }>,
  chatbotId: string
): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const actionUrl = `${supabaseUrl}/functions/v1/facebook-oauth?action=select-page`;

  const pageCards = pages
    .map(
      (page) => `
    <form method="POST" action="${actionUrl}" style="margin-bottom: 12px;">
      <input type="hidden" name="page_id" value="${page.id}" />
      <input type="hidden" name="page_name" value="${escapeHtml(page.name)}" />
      <input type="hidden" name="page_access_token" value="${page.access_token}" />
      <input type="hidden" name="chatbot_id" value="${chatbotId}" />
      <button type="submit" style="
        width: 100%; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px;
        background: white; cursor: pointer; display: flex; align-items: center; gap: 12px;
        transition: all 0.2s; font-family: inherit;
      " onmouseover="this.style.borderColor='#0084ff';this.style.background='#f0f7ff'"
         onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: #0084ff; color: white;
          display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
          ${escapeHtml(page.name.charAt(0))}
        </div>
        <div style="text-align: right; flex: 1;">
          <div style="font-weight: 600; font-size: 16px; color: #1a1a2e;">${escapeHtml(page.name)}</div>
          <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">ID: ${page.id}</div>
        </div>
      </button>
    </form>
  `
    )
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>اختيار الصفحة</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f9fafb;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;}
    .container{max-width:420px;width:100%;margin-top:20px;}</style></head>
    <body><div class="container">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;margin-bottom:8px;">📄</div>
        <h2 style="margin:0;color:#1a1a2e;">اختر الصفحة</h2>
        <p style="color:#6b7280;margin-top:8px;">اختر الصفحة التي تريد ربطها بالشات بوت</p>
      </div>
      ${pageCards}
    </div></body></html>`;
}

function successPage(pageName: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>تم الربط</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;
    background:#f9fafb;min-height:100vh;display:flex;justify-content:center;align-items:center;}
    .container{text-align:center;max-width:360px;}</style></head>
    <body><div class="container">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="color:#1a1a2e;margin:0;">تم الربط بنجاح!</h2>
      <p style="color:#6b7280;margin-top:12px;">تم ربط صفحة <strong>${escapeHtml(pageName)}</strong> بالشات بوت بنجاح.</p>
      <p style="color:#6b7280;">يمكنك إغلاق هذه النافذة الآن.</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'messenger-connected' }, '*');
        setTimeout(() => window.close(), 2000);
      }
    </script></body></html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>خطأ</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;
    background:#f9fafb;min-height:100vh;display:flex;justify-content:center;align-items:center;}
    .container{text-align:center;max-width:360px;}</style></head>
    <body><div class="container">
      <div style="font-size:48px;margin-bottom:16px;">❌</div>
      <h2 style="color:#1a1a2e;margin:0;">حدث خطأ</h2>
      <p style="color:#6b7280;margin-top:12px;">${escapeHtml(message)}</p>
      <button onclick="window.close()" style="margin-top:16px;padding:10px 24px;background:#0084ff;color:white;
        border:none;border-radius:8px;cursor:pointer;font-size:14px;">إغلاق</button>
    </div></body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (req.method === "GET" && action === "auth") {
      return handleAuth(req);
    }

    if (req.method === "GET" && action === "callback") {
      return await handleCallback(req);
    }

    if (req.method === "POST" && action === "select-page") {
      return await handleSelectPage(req);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    if (req.method === "GET") {
      return htmlResponse(
        errorPage(error instanceof Error ? error.message : "خطأ غير متوقع"),
        500
      );
    }
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
