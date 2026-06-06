import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Inline sync logic (duplicated from fetch-social-content to keep edge function self-contained)
const FB_VER = "v21.0";

async function fetchFacebookPage(pageId: string, token: string) {
  const items: any[] = [];
  try {
    const r = await fetch(`https://graph.facebook.com/${FB_VER}/${pageId}?fields=name,about,bio,description,category,website,phone,emails,location,hours&access_token=${token}`);
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
      if (d.hours) parts.push(`ساعات العمل: ${JSON.stringify(d.hours)}`);
      if (parts.length) items.push({ title: `معلومات صفحة فيسبوك — ${d.name || pageId}`, content: parts.join("\n"), source_url: `https://facebook.com/${pageId}` });
    }
  } catch (e) { console.warn(e); }
  try {
    const r = await fetch(`https://graph.facebook.com/${FB_VER}/${pageId}/posts?fields=message,created_time,permalink_url&limit=25&access_token=${token}`);
    const d = await r.json();
    if (!d.error && Array.isArray(d.data)) {
      for (const p of d.data) {
        if (!p.message || p.message.length < 10) continue;
        const date = p.created_time ? p.created_time.slice(0, 10) : "";
        items.push({ title: `منشور فيسبوك — ${date}`, content: p.message.slice(0, 5000), source_url: p.permalink_url || null });
      }
    }
  } catch (e) { console.warn(e); }
  return items;
}

async function fetchInstagramAccount(igId: string, token: string) {
  const items: any[] = [];
  try {
    const r = await fetch(`https://graph.facebook.com/${FB_VER}/${igId}?fields=username,name,biography,website&access_token=${token}`);
    const d = await r.json();
    if (!d.error) {
      const parts: string[] = [];
      if (d.name) parts.push(`الاسم: ${d.name}`);
      if (d.username) parts.push(`اسم المستخدم: @${d.username}`);
      if (d.biography) parts.push(`النبذة: ${d.biography}`);
      if (d.website) parts.push(`الموقع: ${d.website}`);
      if (parts.length) items.push({ title: `معلومات حساب إنستغرام — ${d.username || igId}`, content: parts.join("\n"), source_url: d.username ? `https://instagram.com/${d.username}` : null });
    }
  } catch (e) { console.warn(e); }
  try {
    const r = await fetch(`https://graph.facebook.com/${FB_VER}/${igId}/media?fields=caption,permalink,timestamp&limit=25&access_token=${token}`);
    const d = await r.json();
    if (!d.error && Array.isArray(d.data)) {
      for (const m of d.data) {
        if (!m.caption || m.caption.length < 10) continue;
        const date = m.timestamp ? m.timestamp.slice(0, 10) : "";
        items.push({ title: `منشور إنستغرام — ${date}`, content: m.caption.slice(0, 5000), source_url: m.permalink || null });
      }
    }
  } catch (e) { console.warn(e); }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require service role bearer
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Find distinct source_refs with auto_sync=true
  const { data: refs, error } = await admin
    .from("knowledge_items")
    .select("source_ref")
    .eq("auto_sync", true)
    .eq("type", "social")
    .not("source_ref", "is", null);

  if (error) return json({ error: error.message }, 500);

  const uniqueRefs = Array.from(new Set((refs ?? []).map((r: any) => r.source_ref).filter(Boolean)));
  const results: any[] = [];

  for (const connectionId of uniqueRefs) {
    const { data: conn } = await admin
      .from("social_connections")
      .select("id, chatbot_id, platform, page_id, access_token")
      .eq("id", connectionId)
      .maybeSingle();
    if (!conn) { results.push({ connectionId, skipped: "not found" }); continue; }

    let items: any[] = [];
    if (conn.platform === "facebook") items = await fetchFacebookPage(conn.page_id, conn.access_token);
    else if (conn.platform === "instagram") items = await fetchInstagramAccount(conn.page_id, conn.access_token);
    else { results.push({ connectionId, skipped: "unsupported platform" }); continue; }

    if (items.length === 0) { results.push({ connectionId, inserted: 0, warn: "no content" }); continue; }

    await admin.from("knowledge_items").delete().eq("chatbot_id", conn.chatbot_id).eq("source_ref", connectionId);
    const now = new Date().toISOString();
    const rows = items.map((it) => ({
      chatbot_id: conn.chatbot_id,
      type: "social",
      title: it.title,
      content: it.content,
      file_url: it.source_url ?? null,
      source_ref: connectionId,
      auto_sync: true,
      last_synced_at: now,
    }));
    const { error: insErr } = await admin.from("knowledge_items").insert(rows);
    results.push({ connectionId, inserted: insErr ? 0 : rows.length, error: insErr?.message });
  }

  return json({ success: true, processed: results.length, results });
});