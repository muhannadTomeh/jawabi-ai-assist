import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Facebook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface FacebookPage {
  id: string;
  name: string;
  picture: string | null;
  access_token: string;
}

interface MessengerConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  existingChannel?: {
    id: string;
    config: { page_id?: string; page_name?: string; page_access_token?: string; verify_token?: string } | null;
  } | null;
  onSuccess: () => void;
}

export function MessengerConnectDialog({
  open,
  onOpenChange,
  chatbotId,
  existingChannel,
  onSuccess,
}: MessengerConnectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [step, setStep] = useState<'login' | 'select-page' | 'connecting' | 'done'>('login');
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  // Load Facebook SDK - fetch app ID from edge function then init
  useEffect(() => {
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    const initSDK = async () => {
      // Fetch app ID from edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/facebook-oauth?action=get-app-id`, {
        headers: { apikey: supabaseKey },
      });
      const data = await res.json();
      const appId = data?.app_id;
      if (!appId) {
        console.error('Could not fetch Facebook App ID');
        return;
      }

      window.fbAsyncInit = () => {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: 'v21.0',
        });
        setSdkLoaded(true);
      };

      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      } else {
        // Script already loaded but FB not initialized
        window.fbAsyncInit();
      }
    };

    initSDK();
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPages([]);
      setStep('login');
      setSelectedPage(null);
      setLoading(false);
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleFBLogin = useCallback(() => {
    if (!window.FB) {
      toast.error('لم يتم تحميل Facebook SDK بعد');
      return;
    }

    setLoading(true);

    window.FB.login(
      async (response: any) => {
        if (response.status !== 'connected' || !response.authResponse?.accessToken) {
          setLoading(false);
          toast.error('تم إلغاء تسجيل الدخول');
          return;
        }

        const userAccessToken = response.authResponse.accessToken;

        try {
          // Send token to edge function to get pages
          const { data, error } = await supabase.functions.invoke('facebook-oauth?action=get-pages', {
            body: { user_access_token: userAccessToken },
          });

          if (error || data?.error) {
            throw new Error(data?.error || error?.message || 'فشل في جلب الصفحات');
          }

          setPages(data.pages || []);
          setStep('select-page');
        } catch (err: any) {
          console.error('Get pages error:', err);
          toast.error(err.message || 'فشل في جلب الصفحات');
        } finally {
          setLoading(false);
        }
      },
      {
        scope: 'pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement',
      }
    );
  }, []);

  const handleSelectPage = async (page: FacebookPage) => {
    setSelectedPage(page.id);
    setStep('connecting');

    try {
      const { data, error } = await supabase.functions.invoke('facebook-oauth?action=connect-page', {
        body: {
          chatbot_id: chatbotId,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'فشل في ربط الصفحة');
      }

      setStep('done');
      toast.success(`تم ربط صفحة "${page.name}" بنجاح!`);
      
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Connect page error:', err);
      toast.error(err.message || 'فشل في ربط الصفحة');
      setStep('select-page');
      setSelectedPage(null);
    }
  };

  const isConnected = !!(existingChannel?.config?.page_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ربط فيسبوك ماسنجر</DialogTitle>
          <DialogDescription>
            {step === 'login' && (isConnected
              ? 'الصفحة مربوطة حالياً. يمكنك إعادة الربط بصفحة أخرى.'
              : 'سجّل الدخول بفيسبوك واختر الصفحة التي تريد ربطها')}
            {step === 'select-page' && 'اختر الصفحة التي تريد ربطها بالشات بوت'}
            {step === 'connecting' && 'جاري ربط الصفحة...'}
            {step === 'done' && 'تم الربط بنجاح!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Login Step */}
          {step === 'login' && (
            <>
              {isConnected && existingChannel?.config?.page_name && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-muted-foreground">
                    الصفحة المربوطة حالياً:{' '}
                    <span className="font-medium text-foreground">
                      {existingChannel.config.page_name}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex flex-col items-center gap-4 py-4">
                <div className="rounded-full bg-[#0084ff]/10 p-4">
                  <Facebook className="h-10 w-10 text-[#0084ff]" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  سيتم فتح نافذة لتسجيل الدخول بفيسبوك واختيار الصفحة.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleFBLogin}
                  disabled={loading || !sdkLoaded}
                  className="flex-1 bg-[#0084ff] hover:bg-[#0073e6]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تسجيل الدخول...
                    </>
                  ) : (
                    <>
                      <Facebook className="ml-2 h-4 w-4" />
                      {isConnected ? 'إعادة الربط بفيسبوك' : 'ربط بفيسبوك'}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleClose} disabled={loading}>
                  إلغاء
                </Button>
              </div>
            </>
          )}

          {/* Page Selector Step */}
          {step === 'select-page' && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handleSelectPage(page)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent/50 transition-colors text-right"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {page.picture ? (
                      <img src={page.picture} alt={page.name} className="w-10 h-10 rounded-full" />
                    ) : (
                      page.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{page.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {page.id}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Connecting Step */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري ربط الصفحة وتسجيل الـ Webhook...</p>
            </div>
          )}

          {/* Done Step */}
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
