import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: ask the generate-embedding edge function to compute and
 * store the embedding for a knowledge_items row. Never throws — failures are
 * logged only, so the calling UI keeps working even if OPENAI_API_KEY is not
 * configured.
 */
export async function embedKnowledgeItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("generate-embedding", {
      body: { item_id: itemId },
    });
    if (error) console.warn("embedKnowledgeItem failed:", error);
  } catch (e) {
    console.warn("embedKnowledgeItem threw:", e);
  }
}