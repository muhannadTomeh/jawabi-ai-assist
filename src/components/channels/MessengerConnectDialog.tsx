import { useState } from 'react';
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
import { Loader2, CheckCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MessengerConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  existingChannel?: {
    id: string;
    config: { page_id?: string; page_access_token?: string; verify_token?: string } | null;
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
  const [pageId, setPageId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'success'>('input');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [copied, setCopied] = useState<'webhook' | 'verify' | null>(null);
  const { toast } = useToast();

  const handleClose = () => {
    setPageId('');
    setPageAccessToken('');
    setStep('input');
    setCopied(null);
    onOpenChange(false);
  };

  const copyToClipboard = async (text: string, type: 'webhook' | 'verify') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateVerifyToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleConnect = async () => {
    if (!pageId.trim() || !pageAccessToken.trim()) return;

    setLoading(true);

    try {
      // Validate page access token
      const validateResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?access_token=${pageAccessToken}`
      );
      const validateData = await validateResponse.json();

      if (validateData.error) {
        throw new Error('رمز الوصول غير صحيح');
      }

      // Generate verify token for webhook
      const newVerifyToken = generateVerifyToken();

      // Webhook URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const webhookEndpoint = `${supabaseUrl}/functions/v1/messenger-webhook`;

      // Create or update channel in database
      if (existingChannel) {
        const { error } = await supabase
          .from('channels')
          .update({
            is_connected: true,
            config: {
              page_id: pageId,
              page_access_token: pageAccessToken,
              verify_token: newVerifyToken,
              webhook_url: webhookEndpoint,
            },
          })
          .eq('id', existingChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('channels').insert({
          chatbot_id: chatbotId,
          platform: 'messenger',
          is_connected: true,
          config: {
            page_id: pageId,
            page_access_token: pageAccessToken,
            verify_token: newVerifyToken,
            webhook_url: webhookEndpoint,
          },
        });

        if (error) throw error;
      }

      setWebhookUrl(webhookEndpoint);
      setVerifyToken(newVerifyToken);
      setStep('success');

      toast({
        title: 'تم الحفظ',
        description: 'الآن قم بإضافة الـ Webhook في إعدادات فيسبوك',
      });

      onSuccess();
    } catch (error) {
      console.error('Error connecting Messenger:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ربط فيسبوك ماسنجر</DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'أدخل معلومات صفحة فيسبوك'
              : 'أكمل الإعداد في فيسبوك'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">كيفية الحصول على المعلومات:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>اذهب إلى Meta for Developers</li>
                <li>أنشئ تطبيق جديد واختر Business</li>
                <li>أضف منتج Messenger</li>
                <li>اربط صفحتك واحصل على Page Access Token</li>
              </ol>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto mt-2"
                onClick={() => window.open('https://developers.facebook.com/apps/', '_blank')}
              >
                <ExternalLink className="ml-1 h-3 w-3" />
                فتح Meta for Developers
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-id">معرف الصفحة (Page ID)</Label>
              <Input
                id="page-id"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="123456789012345"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-token">Page Access Token</Label>
              <Input
                id="page-token"
                value={pageAccessToken}
                onChange={(e) => setPageAccessToken(e.target.value)}
                placeholder="EAAxxxxxxx..."
                dir="ltr"
                disabled={loading}
                type="password"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                disabled={!pageId.trim() || !pageAccessToken.trim() || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'التالي'
                )}
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
              <p className="mt-3 text-center text-muted-foreground">
                أضف هذه المعلومات في إعدادات Webhook على فيسبوك
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly dir="ltr" className="text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  >
                    {copied === 'webhook' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input value={verifyToken} readOnly dir="ltr" className="text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(verifyToken, 'verify')}
                  >
                    {copied === 'verify' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">
              <p className="font-medium">خطوة مهمة:</p>
              <p>بعد إضافة الـ Webhook، اختر "messages" من Subscription Fields</p>
            </div>

            <Button onClick={handleClose} className="w-full">
              تم
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
