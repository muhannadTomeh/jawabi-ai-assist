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
import { Loader2, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  existingChannel?: {
    id: string;
    is_connected: boolean;
    config: Record<string, string> | null;
  } | null;
  onSuccess: () => void;
}

export function WhatsAppConnectDialog({
  open,
  onOpenChange,
  chatbotId,
  existingChannel,
  onSuccess,
}: WhatsAppConnectDialogProps) {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState(() =>
    'jawabi_wa_' + Math.random().toString(36).substring(2, 15)
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'webhook' | 'done'>('credentials');
  const [channelId, setChannelId] = useState('');
  const { toast } = useToast();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`;

  const handleConnect = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) return;

    setLoading(true);
    try {
      // Test the token by fetching phone number info
      const testResponse = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${accessToken}`
      );

      if (!testResponse.ok) {
        throw new Error('Phone Number ID أو Access Token غير صالح');
      }

      const phoneData = await testResponse.json();
      const displayPhone = phoneData.display_phone_number || phoneNumberId;

      // Create or update channel
      if (existingChannel) {
        const { error } = await supabase
          .from('channels')
          .update({
            is_connected: true,
            config: {
              phone_number_id: phoneNumberId,
              access_token: accessToken,
              verify_token: verifyToken,
              display_phone: displayPhone,
            },
          })
          .eq('id', existingChannel.id);

        if (error) throw error;
        setChannelId(existingChannel.id);
      } else {
        const { data, error } = await supabase
          .from('channels')
          .insert({
            chatbot_id: chatbotId,
            platform: 'whatsapp',
            is_connected: true,
            config: {
              phone_number_id: phoneNumberId,
              access_token: accessToken,
              verify_token: verifyToken,
              display_phone: displayPhone,
            },
          })
          .select()
          .single();

        if (error) throw error;
        setChannelId(data.id);
      }

      setStep('webhook');
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء الربط',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setStep('done');
    onSuccess();
    setTimeout(() => {
      onOpenChange(false);
      setStep('credentials');
      setPhoneNumberId('');
      setAccessToken('');
    }, 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>ربط واتساب</DialogTitle>
          <DialogDescription>
            {step === 'credentials' && 'أدخل بيانات WhatsApp Business API من Meta for Developers'}
            {step === 'webhook' && 'قم بإعداد الـ Webhook في Meta for Developers'}
            {step === 'done' && 'تم الربط بنجاح!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'credentials' && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="مثال: 123456789012345"
                disabled={loading}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                تجده في Meta for Developers → WhatsApp → API Setup
              </p>
            </div>

            <div className="space-y-2">
              <Label>Permanent Access Token</Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="أدخل التوكن الدائم"
                disabled={loading}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                أنشئ توكن دائم من Business Settings → System Users
              </p>
            </div>

            <Button
              onClick={handleConnect}
              disabled={!phoneNumberId.trim() || !accessToken.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                'التالي'
              )}
            </Button>
          </div>
        )}

        {step === 'webhook' && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              اذهب إلى Meta for Developers → WhatsApp → Configuration → Webhook وأضف:
            </p>

            <div className="space-y-2">
              <Label>Callback URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly dir="ltr" className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Verify Token</Label>
              <div className="flex gap-2">
                <Input value={verifyToken} readOnly dir="ltr" className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(verifyToken)}>
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

            <Button onClick={handleDone} className="w-full">
              تم إعداد الـ Webhook
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-foreground">تم ربط واتساب بنجاح!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
