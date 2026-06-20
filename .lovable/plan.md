
## Plan

Fix Facebook Webhook verification in `supabase/functions/messenger-webhook/index.ts`.

### Problem
The current GET handler uses Supabase `.filter("metadata->verify_token", "eq", token)` to match JSONB fields. This operator does not work reliably for nested JSON string matching in Supabase PostgREST, causing webhook verification to fail silently.

### Solution
Replace both verification lookups (social_connections and legacy channels) with a fetch-then-filter pattern:
1. Query all matching rows by basic filters (platform, is_connected).
2. Filter the returned array in JavaScript by comparing `c.metadata?.verify_token === token` and `c.config?.verify_token === token`.

### Exact change
- Replace lines 46–71 in `supabase/functions/messenger-webhook/index.ts` with the code provided by the user.

### Deploy
- Lovable-managed edge functions deploy automatically after file change.
