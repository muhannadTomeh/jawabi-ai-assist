import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function embed(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured; cannot generate embedding");
    return null;
  }
  const cleaned = (text || "").trim();
  if (!cleaned) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: cleaned.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!res.ok) {
      console.error("OpenAI embeddings error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("Embedding call failed:", e);
    return null;
  }
}

function combinedText(row: {
  title?: string | null;
  question?: string | null;
  answer?: string | null;
  content?: string | null;
}): string {
  return [row.title, row.question, row.answer, row.content]
    .filter((v) => v && String(v).trim().length > 0)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { text, item_id, backfill, chatbot_id } = body || {};

    // Backfill mode: iterate rows with null embedding and populate.
    if (backfill) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      let query = supabase
        .from("knowledge_items")
        .select("id, title, question, answer, content")
        .is("embedding", null)
        .limit(200);
      if (chatbot_id) query = query.eq("chatbot_id", chatbot_id);
      const { data: rows, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let updated = 0;
      for (const row of rows || []) {
        const emb = await embed(combinedText(row as any));
        if (!emb) continue;
        const { error: uErr } = await supabase
          .from("knowledge_items")
          .update({ embedding: emb as any })
          .eq("id", (row as any).id);
        if (!uErr) updated++;
      }
      return new Response(
        JSON.stringify({ ok: true, scanned: rows?.length || 0, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Item mode: embed a specific knowledge_items row and store on it.
    if (item_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: row, error } = await supabase
        .from("knowledge_items")
        .select("id, title, question, answer, content")
        .eq("id", item_id)
        .maybeSingle();
      if (error || !row) {
        return new Response(
          JSON.stringify({ error: error?.message || "not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const emb = await embed(combinedText(row as any));
      if (!emb) {
        return new Response(JSON.stringify({ embedding: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("knowledge_items")
        .update({ embedding: emb as any })
        .eq("id", item_id);
      return new Response(JSON.stringify({ embedding: emb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text mode: just return the embedding.
    if (typeof text === "string") {
      const emb = await embed(text);
      return new Response(JSON.stringify({ embedding: emb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Provide 'text', 'item_id', or 'backfill: true'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-embedding error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});