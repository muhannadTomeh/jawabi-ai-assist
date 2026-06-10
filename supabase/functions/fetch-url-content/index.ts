import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlToText(html: string): string {
  // Remove script/style
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Strip tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common entities
  text = text.replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function normalizeUrl(url: string): string {
  // Google Drive file → direct download
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile) {
    return `https://drive.google.com/uc?export=download&id=${driveFile[1]}`;
  }
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpen) {
    return `https://drive.google.com/uc?export=download&id=${driveOpen[1]}`;
  }
  // Google Docs → export as plain text
  const docs = url.match(/docs\.google\.com\/document\/d\/([^/]+)/);
  if (docs) {
    return `https://docs.google.com/document/d/${docs[1]}/export?format=txt`;
  }
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, chatbot_id, title: userTitle } = await req.json();
    if (!url || !chatbot_id) {
      return new Response(JSON.stringify({ error: "url and chatbot_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "رابط غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "يجب أن يبدأ الرابط بـ http أو https" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify auth via user JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify chatbot ownership
    const { data: bot } = await supabase
      .from("chatbots").select("id,user_id").eq("id", chatbot_id).maybeSingle();
    if (!bot || bot.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch URL
    const fetchUrl = normalizeUrl(url);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    let resp: Response;
    try {
      resp = await fetch(fetchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (e) {
      clearTimeout(t);
      return new Response(JSON.stringify({ error: "تعذر الوصول إلى الرابط: " + (e as Error).message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(t);

    if (!resp.ok) {
      const hint = resp.status === 403 || resp.status === 401
        ? " — قد يكون الموقع يمنع الجلب الآلي. جرّب رابطاً مختلفاً أو رابط Google Docs/Drive."
        : "";
      return new Response(JSON.stringify({ error: `استجابة الخادم: ${resp.status}${hint}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = resp.headers.get("content-type") || "";
    const raw = await resp.text();
    let text = "";
    let pageTitle: string | null = null;

    if (contentType.includes("text/html") || /<html[\s>]/i.test(raw)) {
      pageTitle = extractTitle(raw);
      text = htmlToText(raw);
    } else {
      text = raw;
    }

    if (!text || text.length < 20) {
      return new Response(JSON.stringify({ error: "لم نتمكن من استخراج محتوى مفيد من الرابط" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap content size (~50k chars)
    if (text.length > 50000) text = text.slice(0, 50000) + "…";

    const finalTitle = (userTitle && userTitle.trim()) || pageTitle || parsed.hostname;

    const { error: insertErr } = await supabase.from("knowledge_items").insert({
      chatbot_id,
      type: "url",
      title: finalTitle,
      content: text,
      file_url: url,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, title: finalTitle, length: text.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});