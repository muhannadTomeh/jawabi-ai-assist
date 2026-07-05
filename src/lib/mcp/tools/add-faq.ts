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
  name: "add_faq",
  title: "Add FAQ",
  description:
    "Add a question/answer pair to the signed-in user's chatbot knowledge base. Use for teaching the bot specific answers.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Short title/label for this FAQ."),
    question: z.string().trim().min(1).describe("The customer question."),
    answer: z.string().trim().min(1).describe("The answer the bot should give."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, question, answer }, ctx) => {
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
      .insert({ chatbot_id: chatbot.id, type: "faq", title, question, answer })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `FAQ added (id: ${data.id}).` }],
      structuredContent: { item: data },
    };
  },
});