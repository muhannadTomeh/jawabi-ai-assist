import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Facebook, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// supabase.functions.invoke throws FunctionsHttpError with a Response in `context`
// on non-2xx. The default `error.message` is a generic "Edge Function returned a
// non-2xx status code" — the real reason is only in the response body.
async function extractInvokeError(error: any, data: any): Promise<string | null> {
  if (data?.error) return String(data.error);
  if (!error) return null;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      const body = await cloned.json();
      if (body?.error) return String(body.error);
      return JSON.stringify(body);
    }
    if (ctx && typeof ctx.text === 'function') {
      const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      const txt = await cloned.text();
      if (txt) return txt;
    }
  } catch {
    /* fall through */
  }
  return error?.message || null;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

type Platform = 'facebook' | 'instagram' | 'whatsapp';

interface OAuthConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  chatbotId: string;
  onSuccess: () => void;
}

const PLATFORM_CONFIG = {
  facebook: {
    title: 'ربط فيسبوك ماسنجر',
    icon: '📘',
    color: 'bg-[#0084ff]',
    hoverColor: 'hover:bg-[#0073e6]',
    loginText: 'ربط بفيسبوك',
    scopes: 'pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement',
  },
  instagram: {
    title: 'ربط انستغرام',
    icon: '📸',
    color: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
    hoverColor: 'hover:opacity-90',
    loginText: 'ربط بانستغرام',
    scopes: 'instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement',
  },
  whatsapp: {
    title: 'ربط واتساب',
    icon: '💬',
    color: 'bg-[#25D366]',
    hoverColor: 'hover:bg-[#1DA851]',
    loginText: 'ربط بواتساب',
    scopes: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
  },
};

export function OAuthConnectDialog({
  open,
  onOpenChange,
  platform,
  chatbotId,
  onSuccess,
}: OAuthConnectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [step, setStep] = useState<'login' | 'select' | 'webhook' | 'connecting' | 'done'>('login');
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; token: string } | null>(null);

  const config = PLATFORM_CONFIG[platform];

  // Load Facebook SDK
  useEffect(() => {
    const initSDK = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/facebook-oauth?action=get-app-id`, {
          headers: { apikey: supabaseKey },
        });
        const data = await res.json();
        const appId = data?.app_id;
        if (!appId) return;

        await new Promise<void>((resolve, reject) => {
          if (window.FB) { resolve(); return; }
          const existing = document.getElementById('facebook-jssdk');
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.id = 'facebook-jssdk';
          script.src = 'https://connect.facebook.net/en_US/sdk.js';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.body.appendChild(script);
        });

        if (!window.FB) return;
        const currentAppId = typeof window.FB.getAppId === 'function' ? window.FB.getAppId() : null;
        if (!currentAppId) {
          window.FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
        }
        setSdkLoaded(true);
      } catch (error) {
        console.error('Facebook SDK init error:', error);
      }
    };
    initSDK();
  }, []);

  useEffect(() => {
    if (open) {
      setItems([]);
      setStep('login');
      setLoading(false);
      setWebhookInfo(null);
    }
  }, [open]);

  const handleFBLogin = useCallback(() => {
    if (!window.FB) {
      toast.error('لم يتم تحميل Facebook SDK بعد');
      return;
    }

    setLoading(true);

    window.FB.login(
      (response: any) => {
        if (response.status !== 'connected' || !response.authResponse?.accessToken) {
          setLoading(false);
          toast.error('تم إلغاء تسجيل الدخول');
          return;
        }

        const userAccessToken = response.authResponse.accessToken;
        const actionMap: Record<Platform, string> = {
          facebook: 'get-pages',
          instagram: 'get-instagram-accounts',
          whatsapp: 'get-whatsapp-accounts',
        };

        supabase.functions
          .invoke('facebook-oauth', {
            body: { action: actionMap[platform], user_access_token: userAccessToken },
          })
          .then(async ({ data, error }) => {
            if (error || data?.error) {
              const msg = await extractInvokeError(error, data);
              console.error('facebook-oauth invoke failed:', { action: actionMap[platform], error, data, resolved: msg });
              toast.error(msg || 'فشل في جلب البيانات');
              return;
            }

            const itemsList = data.pages || data.accounts || [];
            setItems(itemsList.map((item: any) => ({ ...item, long_lived_token: data.long_lived_token })));
            setStep('select');
          })
          .catch((err: any) => toast.error(err.message || 'خطأ'))
          .finally(() => setLoading(false));
      },
      { scope: config.scopes }
    );
  }, [platform, config.scopes]);

  const handleSelect = async (item: any) => {
    setStep('connecting');

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('يجب تسجيل الدخول أولاً');

      let connectBody: any;

      if (platform === 'facebook') {
        connectBody = {
          action: 'connect-facebook',
          chatbot_id: chatbotId,
          user_id: session.user.id,
          page_id: item.id,
          page_name: item.name,
          page_access_token: item.access_token,
        };
      } else if (platform === 'instagram') {
        connectBody = {
          action: 'connect-instagram',
          chatbot_id: chatbotId,
          user_id: session.user.id,
          page_id: item.page_id,
          page_name: item.page_name,
          page_access_token: item.page_access_token,
          ig_id: item.ig_id,
          ig_name: item.ig_name,
          ig_username: item.ig_username,
        };
      } else {
        connectBody = {
          action: 'connect-whatsapp',
          chatbot_id: chatbotId,
          user_id: session.user.id,
          phone_number_id: item.phone_number_id,
          display_phone: item.display_phone,
          verified_name: item.verified_name,
          waba_id: item.waba_id,
          long_lived_token: item.long_lived_token,
        };
      }

      const { data, error } = await supabase.functions.invoke('facebook-oauth', {
        body: connectBody,
      });

      if (error || data?.error) {
        const msg = await extractInvokeError(error, data);
        console.error('facebook-oauth connect failed:', { action: connectBody.action, error, data, resolved: msg });
        throw new Error(msg || 'فشل في الربط');
      }

      if (platform === 'whatsapp' && data.webhook_url && data.verify_token) {
        setWebhookInfo({ url: data.webhook_url, token: data.verify_token });
        setStep('webhook');
      } else {
        setStep('done');
        toast.success(`تم الربط بنجاح!`);
        setTimeout(() => { onSuccess(); onOpenChange(false); }, 1500);
      }
    } catch (err: any) {
      console.error('Connect error:', err);
      toast.error(err.message || 'فشل في الربط');
      setStep('select');
    }
  };

  const handleWebhookDone = () => {
    setStep('done');
    toast.success('تم ربط واتساب بنجاح!');
    onSuccess();
    setTimeout(() => onOpenChange(false), 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم النسخ');
  };

  const renderItemLabel = (item: any) => {
    if (platform === 'facebook') return { primary: item.name, secondary: `ID: ${item.id}`, picture: item.picture };
    if (platform === 'instagram') return { primary: item.ig_name || item.ig_username, secondary: `@${item.ig_username}`, picture: item.ig_picture };
    return { primary: item.verified_name || item.display_phone, secondary: item.display_phone, picture: null };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {step === 'login' && 'سجّل الدخول بفيسبوك واختر الحساب الذي تريد ربطه'}
            {step === 'select' && 'اختر الحساب الذي تريد ربطه بالشات بوت'}
            {step === 'webhook' && 'قم بإعداد الـ Webhook في Meta for Developers'}
            {step === 'connecting' && 'جاري الربط...'}
            {step === 'done' && 'تم الربط بنجاح!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Login Step */}
          {step === 'login' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-5xl">{config.icon}</div>
              <p className="text-center text-sm text-muted-foreground">
                سيتم فتح نافذة لتسجيل الدخول بفيسبوك ومنح الصلاحيات المطلوبة.
              </p>
              <div className="flex gap-2 w-full">
                <Button
                  onClick={handleFBLogin}
                  disabled={loading || !sdkLoaded}
                  className={`flex-1 text-white ${config.color} ${config.hoverColor}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تسجيل الدخول...
                    </>
                  ) : (
                    <>
                      <Facebook className="ml-2 h-4 w-4" />
                      {config.loginText}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  إلغاء
                </Button>
              </div>
            </div>
          )}

          {/* Select Step */}
          {step === 'select' && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {items.map((item, idx) => {
                const label = renderItemLabel(item);
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent/50 transition-colors text-right"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                      {label.picture ? (
                        <img src={label.picture} alt={label.primary} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        label.primary?.charAt(0) || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{label.primary}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{label.secondary}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Webhook Step (WhatsApp) */}
          {step === 'webhook' && webhookInfo && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                اذهب إلى Meta for Developers → WhatsApp → Configuration → Webhook وأضف:
              </p>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookInfo.url} readOnly dir="ltr" className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookInfo.url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input value={webhookInfo.token} readOnly dir="ltr" className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookInfo.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">الخطوات:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>الصق Callback URL و Verify Token</li>
                  <li>اضغط "Verify and Save"</li>
                  <li>اشترك في حقل <strong>messages</strong></li>
                </ol>
              </div>
              <Button onClick={handleWebhookDone} className="w-full">تم إعداد الـ Webhook</Button>
            </div>
          )}

          {/* Connecting */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري الربط...</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-sm text-foreground font-medium">تم الربط بنجاح!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
