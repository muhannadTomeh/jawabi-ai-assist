

## Switch to Facebook JavaScript SDK Login (No Redirect URI Required)

### The Problem
The current implementation uses server-side OAuth redirect flow, which requires manually adding a Redirect URI in the Facebook App settings. The user wants a seamless experience like other platforms (ManyChat, Chatfuel, etc.).

### The Solution
Switch to the **Facebook JavaScript SDK** (`FB.login()`) approach. This uses a popup-based login that does NOT require configuring redirect URIs in the Facebook App. The user clicks "Connect with Facebook", a Facebook popup appears, they log in and grant permissions, and the short-lived token is returned directly to the frontend. The frontend then sends this token to a backend function that handles the secure server-side work (exchange for long-lived token, fetch pages, etc.).

### Flow

```text
User clicks "Connect" → FB.login() popup → User grants permissions
→ Short-lived user token returned to frontend
→ Frontend sends token + chatbotId to Edge Function
→ Edge Function: exchanges for long-lived token, fetches pages, returns page list
→ Frontend shows page selector in-dialog
→ User picks a page → Frontend sends selection to Edge Function
→ Edge Function: saves config, subscribes webhook → Done
```

### Changes

**1. `src/components/channels/MessengerConnectDialog.tsx`**
- Load Facebook JS SDK dynamically (`https://connect.facebook.net/en_US/sdk.js`)
- Replace the popup-to-edge-function approach with `FB.login()` call requesting `pages_messaging, pages_show_list, pages_manage_metadata` scopes
- On successful login, call the edge function with the user access token to get pages list
- Show page selector directly inside the dialog (no separate HTML page)
- On page selection, call edge function to finalize the connection

**2. `supabase/functions/facebook-oauth/index.ts`**
- Add new action `get-pages`: receives a short-lived user token, exchanges it for a long-lived token, fetches pages list, returns JSON
- Add new action `connect-page`: receives chatbotId + pageId + pageAccessToken (from the pages list), subscribes webhook, saves to DB, returns JSON success
- Keep existing actions for backward compatibility but the frontend will no longer use `auth` or `callback`

**3. No Facebook App configuration needed**
- The JS SDK flow uses the App ID only and does not require a Redirect URI to be set
- The user just needs a valid Facebook App with the correct permissions enabled

### Security Note
The short-lived user access token is sent to the backend immediately and never stored on the frontend. All sensitive operations (token exchange, page token retrieval, webhook subscription, DB storage) remain server-side only.

