import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

const FB_VER = "v21.0";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Item {
  title: string;
  content: string;
  source_url?: string | null;
}

async function fetchFacebookPage(pageId: string, token: string): Promise<Item[]> {
  const items: Item[] = [];

  // Page info
  const infoUrl = `https://graph.facebook.com/${FB_VER}/${pageId}?fields=name,about,bio,description,category,website,phone,emails,location,hours&access_token=${token}`;
  try {
    const r = await fetch(infoUrl);
    const d = await r.json();
    if (!d.error) {
      const parts: string[] = [];
      if (d.name) parts.push(`اسم الصفحة: ${d.name}`);
      if (d.category) parts.push(`الفئة: ${d.category}`);
      if (d.about) parts.push(`عن الصفحة: ${d.about}`);
      if (d.bio) parts.push(`نبذة: ${d.bio}`);
      if (d.description) parts.push(`الوصف: ${d.description}`);
      if (d.website) parts.push(`الموقع: ${d.website}`);
      if (d.phone) parts.push(`الهاتف: ${d.phone}`);
      if (Array.isArray(d.emails)) parts.push(`البريد: ${d.emails.join(", ")}`);
      if (d.location) {
        const loc = [d.location.street, d.location.city, d.location.country].filter(Boolean).join(", ");
        if (loc) parts.push(`العنوان: ${loc}`);
      }
      if (d.hours) parts.push(`ساعات العمل: ${JSON.stringify(d.hours)}`);
      if (parts.length) {
        items.push({
          title: `معلومات صفحة فيسبوك — ${d.name || pageId}`,
          content: parts.join("\n"),
          source_url: `https://facebook.com/${pageId}`,
        });
      }
    } else {
      console.warn("FB page info error", d.error);
    }
  } catch (e) {
    console.warn("FB info fetch failed", e);
  }

  // Posts
  const postsUrl = `https://graph.facebook.com/${FB_VER}/${pageId}/posts?fields=message,created_time,permalink_url&limit=25&access_token=${token}`;
  try {
    const r = await fetch(postsUrl);
    const d = await r.json();
    if (!d.error && Array.isArray(d.data)) {
      for (const p of d.data) {
        if (!p.message || p.message.length < 10) continue;
        const date = p.created_time ? p.created_time.slice(0, 10) : "";
        items.push({
          title: `منشور فيسبوك — ${date}`,
          content: p.message.slice(0, 5000),
          source_url: p.permalink_url || null,
        });
      }
    } else if (d.error) {
      console.warn("FB posts error", d.error);
    }
  } catch (e) {
    console.warn("FB posts fetch failed", e);
  }

  return items;
}

async function fetchInstagramAccount(igId: string, token: string): Promise<Item[]> {
  const items: Item[] = [];

  // Profile info
  const infoUrl = `https://graph.facebook.com/${FB_VER}/${igId}?fields=username,name,biography,website&access_token=${token}`;
  try {
    const r = await fetch(infoUrl);
    const d = await r.json();
    if (!d.error) {
      const parts: string[] = [];
      if (d.name) parts.push(`الاسم: ${d.name}`);
      if (d.username) parts.push(`اسم المستخدم: @${d.username}`);
      if (d.biography) parts.push(`النبذة: ${d.biography}`);
      if (d.website) parts.push(`الموقع: ${d.website}`);
      if (parts.length) {
        items.push({
          title: `معلومات حساب إنستغرام — ${d.username || igId}`,
          content: parts.join("\n"),
          source_url: d.username ? `https://instagram.com/${d.username}` : null,
        });
      }
    } else {
      console.warn("IG info error", d.error);
    }
  } catch (e) {
    console.warn("IG info fetch failed", e);
  }

  // Media captions
  const mediaUrl = `https://graph.facebook.com/${FB_VER}/${igId}/media?fields=caption,permalink,timestamp&limit=25&access_token=${token}`;
  try {
    const r = await fetch(mediaUrl);
    const d = await r.json();
    if (!d.error && Array.isArray(d.data)) {
      for (const m of d.data) {
        if (!m.caption || m.caption.length < 10) continue;
        const date = m.timestamp ? m.timestamp.slice(0, 10) : "";
        items.push({
          title: `منشور إنستغرام — ${date}`,
          content: m.caption.slice(0, 5000),
          source_url: m.permalink || null,
        });
      }
    } else if (d.error) {
      console.warn("IG media error", d.error);
    }
  } catch (e) {
    console.warn("IG media fetch failed", e);
  }

  return items;
}

export async function syncConnection(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  autoSync: boolean,
): Promise<{ inserted: number; error?: string }> {
  const { data: conn, error: connErr } = await supabase
    .from("social_connections")
    .select("id, chatbot_id, user_id, platform, page_id, page_name, access_token")
    .eq("id", connectionId)
    .maybeSingle();

  if (connErr || !conn) return { inserted: 0, error: "الصفحة غير موجودة" };
  if (!["facebook", "instagram"].includes(conn.platform)) {
    return { inserted: 0, error: "هذه القناة لا تدعم جلب المحتوى" };
  }

  let items: Item[] = [];
  if (conn.platform === "facebook") {
    items = await fetchFacebookPage(conn.page_id, conn.access_token);
  } else {
    items = await fetchInstagramAccount(conn.page_id, conn.access_token);
  }

  if (items.length === 0) {
    return { inserted: 0, error: "لم نتمكن من جلب أي محتوى. تأكد من صلاحيات الصفحة." };
  }

  // Delete previous items for same source_ref
  await supabase
    .from("knowledge_items")
    .delete()
    .eq("chatbot_id", conn.chatbot_id)
    .eq("source_ref", connectionId);

  const now = new Date().toISOString();
  const rows = items.map((it) => ({
    chatbot_id: conn.chatbot_id,
    type: "social",
    title: it.title,
    content: it.content,
    file_url: it.source_url ?? null,
    source_ref: connectionId,
    auto_sync: autoSync,
    last_synced_at: now,
  }));

  const { error: insErr } = await supabase.from("knowledge_items").insert(rows);
  if (insErr) return { inserted: 0, error: insErr.message };

  return { inserted: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { connection_id, auto_sync = false } = body;
    if (!connection_id) return json({ error: "connection_id مطلوب" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user owns connection
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: conn } = await admin
      .from("social_connections")
      .select("user_id")
      .eq("id", connection_id)
      .maybeSingle();
    if (!conn || conn.user_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    const result = await syncConnection(admin, connection_id, !!auto_sync);
    if (result.error) return json({ error: result.error }, 400);
    return json({ success: true, inserted: result.inserted });
  } catch (e) {
    console.error("fetch-social-content error", e);
    return json({ error: (e as Error).message }, 500);
  }
});