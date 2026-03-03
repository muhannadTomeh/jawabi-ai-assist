import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Facebook } from 'lucide-react';

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

  const handleClose = () => {
    onOpenChange(false);
  };

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'messenger-connected') {
        onSuccess();
        handleClose();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSuccess]);

  const handleConnect = () => {
    setLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const oauthUrl = `${supabaseUrl}/functions/v1/facebook-oauth?action=auth&chatbot_id=${chatbotId}`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      oauthUrl,
      'facebook-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Poll to detect popup close
    const interval = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 500);
  };

  const isConnected = !!(existingChannel?.config?.page_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ربط فيسبوك ماسنجر</DialogTitle>
          <DialogDescription>
            {isConnected
              ? 'الصفحة مربوطة حالياً. يمكنك إعادة الربط بصفحة أخرى.'
              : 'سجّل الدخول بفيسبوك واختر الصفحة التي تريد ربطها'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <br />
              سيتم تسجيل الـ Webhook تلقائياً.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="flex-1 bg-[#0084ff] hover:bg-[#0073e6]"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الربط...
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
