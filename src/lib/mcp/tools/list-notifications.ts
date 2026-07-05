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
  name: "list_notifications",
  title: "List recent notifications",
  description:
    "List recent notifications (sale intents, human-handover requests, unclear questions) for the signed-in user's chatbot.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: chatbot } = await sb
      .from("chatbots")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (!chatbot) return { content: [{ type: "text", text: "No chatbot found." }] };
    const { data, error } = await sb
      .from("notifications")
      .select("id, type, title, channel, contact_identifier, last_message, created_at")
      .eq("chatbot_id", chatbot.id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});