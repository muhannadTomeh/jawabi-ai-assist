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

interface TelegramConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  existingChannel?: {
    id: string;
    config: { bot_token?: string; bot_username?: string } | null;
  } | null;
  onSuccess: () => void;
}

export function TelegramConnectDialog({
  open,
  onOpenChange,
  chatbotId,
  existingChannel,
  onSuccess,
}: TelegramConnectDialogProps) {
  const [botToken, setBotToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'success'>('input');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setBotToken('');
    setStep('input');
    setCopied(false);
    onOpenChange(false);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    if (!botToken.trim()) return;

    setLoading(true);

    try {
      // Validate the bot token with Telegram API
      const validateResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const validateData = await validateResponse.json();

      if (!validateData.ok) {
        throw new Error('رمز البوت غير صحيح');
      }

      const botUsername = validateData.result.username;

      // Set up webhook URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const webhookEndpoint = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;

      // Register webhook with Telegram
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookEndpoint }),
        }
      );
      const webhookData = await webhookResponse.json();

      if (!webhookData.ok) {
        throw new Error('فشل في تسجيل الـ Webhook');
      }

      // Create or update channel in database
      if (existingChannel) {
        const { error } = await supabase
          .from('channels')
          .update({
            is_connected: true,
            config: {
              bot_token: botToken,
              bot_username: botUsername,
              webhook_url: webhookEndpoint,
            },
          })
          .eq('id', existingChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('channels').insert({
          chatbot_id: chatbotId,
          platform: 'telegram',
          is_connected: true,
          config: {
            bot_token: botToken,
            bot_username: botUsername,
            webhook_url: webhookEndpoint,
          },
        });

        if (error) throw error;
      }

      setWebhookUrl(webhookEndpoint);
      setStep('success');

      toast({
        title: 'تم الربط بنجاح',
        description: `تم ربط بوت @${botUsername} بنجاح`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error connecting Telegram:', error);
      toast({
        title: 'خطأ في الربط',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء الربط',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ربط بوت تيليجرام</DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'أدخل رمز البوت الذي حصلت عليه من BotFather'
              : 'تم ربط البوت بنجاح!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">كيفية الحصول على رمز البوت:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>افتح تيليجرام وابحث عن @BotFather</li>
                <li>أرسل /newbot واتبع الخطوات</li>
                <li>انسخ الرمز الذي يبدأ بأرقام</li>
              </ol>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto mt-2"
                onClick={() => window.open('https://t.me/botfather', '_blank')}
              >
                <ExternalLink className="ml-1 h-3 w-3" />
                فتح BotFather
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-token">رمز البوت (Bot Token)</Label>
              <Input
                id="bot-token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCDefGHIjklMNOpqrsTUVwxyz"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                disabled={!botToken.trim() || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الربط...
                  </>
                ) : (
                  'ربط البوت'
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
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="mt-3 text-center text-muted-foreground">
                البوت جاهز لاستقبال الرسائل الآن
              </p>
            </div>

            <div className="space-y-2">
              <Label>رابط الـ Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly dir="ltr" className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
