import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";

// Narrow local typings for the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string; client_uri?: string; logo_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function safeNext(pathAndQuery: string): string {
  // Same-origin relative path only.
  if (!pathAndQuery.startsWith("/") || pathAndQuery.startsWith("//")) return "/dashboard";
  return pathAndQuery;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
    const { data, error } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-background text-right">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h1 className="text-xl font-bold">تعذّر تحميل طلب الربط</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline"><Link to="/dashboard">العودة للوحة التحكم</Link></Button>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName = details.client?.name ?? "تطبيق خارجي";

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-background text-right">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ربط {clientName} بحسابك</h1>
            <p className="text-sm text-muted-foreground">
              سيتمكن هذا التطبيق من استخدام أدوات جوابي نيابةً عنك.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            الصلاحيات المطلوبة
          </div>
          <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
            <li>قراءة إعدادات الشات بوت الخاص بك</li>
            <li>قراءة وإضافة عناصر قاعدة المعرفة (نصوص وأسئلة شائعة)</li>
            <li>قراءة الإشعارات الأخيرة</li>
            <li>تحديث إعدادات الشات بوت (شخصية، لهجة، رسائل)</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            الموافقة والربط
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            رفض
          </Button>
        </div>
      </div>
    </main>
  );
}

export { safeNext };