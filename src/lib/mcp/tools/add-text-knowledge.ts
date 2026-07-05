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
  name: "add_text_knowledge",
  title: "Add text knowledge",
  description:
    "Add a free-form text passage (business info, policy, product description) to the signed-in user's chatbot knowledge base.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Short title/label for this passage."),
    content: z.string().trim().min(1).describe("The text content the bot should learn."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ title, content }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: chatbot } = await sb
      .from("chatbots")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (!chatbot) return { content: [{ type: "text", text: "No chatbot found." }], isError: true };
    const { data, error } = await sb
      .from("knowledge_items")
      .insert({ chatbot_id: chatbot.id, type: "text", title, content })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Text knowledge added (id: ${data.id}).` }],
      structuredContent: { item: data },
    };
  },
});