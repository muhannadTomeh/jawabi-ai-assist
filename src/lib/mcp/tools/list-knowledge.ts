import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_knowledge_items",
  title: "List knowledge base items",
  description:
    "List knowledge base entries (text, FAQ, files, URLs, social, images) for the signed-in user's chatbot. Optionally filter by type.",
  inputSchema: {
    type: z
      .enum(["text", "faq", "file", "url", "social", "image"])
      .optional()
      .describe("Filter by knowledge item type."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: chatbot, error: cbErr } = await sb
      .from("chatbots")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (cbErr) return { content: [{ type: "text", text: cbErr.message }], isError: true };
    if (!chatbot) return { content: [{ type: "text", text: "No chatbot found." }] };

    let q = sb
      .from("knowledge_items")
      .select("id, type, title, question, answer, content, file_name, file_url, created_at")
      .eq("chatbot_id", chatbot.id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});