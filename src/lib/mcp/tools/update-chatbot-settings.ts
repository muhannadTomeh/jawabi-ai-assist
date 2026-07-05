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
  name: "update_chatbot_settings",
  title: "Update chatbot settings",
  description:
    "Update the signed-in user's chatbot persona and behavior: name, tone, dialect, welcome/fallback messages, custom instructions, and bot_mode.",
  inputSchema: {
    name: z.string().trim().min(1).optional(),
    tone: z.enum(["professional", "friendly", "casual", "formal"]).optional(),
    dialect: z.enum(["palestinian", "formal"]).optional(),
    welcome_message: z.string().optional(),
    fallback_message: z.string().optional(),
    custom_instructions: z.string().optional(),
    bot_mode: z.enum(["inquiries_only", "inquiries_sales", "inquiries_sales_followup"]).optional(),
    is_active: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const updates = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("chatbots")
      .update(updates)
      .eq("user_id", ctx.getUserId())
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No chatbot found." }], isError: true };
    return {
      content: [{ type: "text", text: "Chatbot updated." }],
      structuredContent: { chatbot: data },
    };
  },
});