import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyChatbot from "./tools/get-my-chatbot";
import listKnowledge from "./tools/list-knowledge";
import addFaq from "./tools/add-faq";
import addTextKnowledge from "./tools/add-text-knowledge";
import listNotifications from "./tools/list-notifications";
import updateChatbotSettings from "./tools/update-chatbot-settings";

// The OAuth issuer must be the direct Supabase host, not any .lovable.cloud proxy.
// Build it from the project ref, which Vite inlines as a literal at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jawabi-mcp",
  title: "Jawabi MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Jawabi chatbot platform. Each signed-in user has ONE chatbot. Use these tools to read the user's chatbot configuration, list and add knowledge base entries (FAQs and text passages), review recent customer notifications, and update chatbot persona/behavior settings.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyChatbot,
    listKnowledge,
    addFaq,
    addTextKnowledge,
    listNotifications,
    updateChatbotSettings,
  ],
});