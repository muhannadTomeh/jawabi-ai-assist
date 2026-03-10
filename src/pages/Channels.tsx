import { useState, useEffect } from 'react';
import { Share2, ExternalLink, Settings, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useChatbot } from '@/hooks/useChatbot';
import { useToast } from '@/hooks/use-toast';
import { TelegramConnectDialog } from '@/components/channels/TelegramConnectDialog';
import { OAuthConnectDialog } from '@/components/channels/OAuthConnectDialog';

type Platform = 'telegram' | 'facebook' | 'instagram' | 'whatsapp';

interface Channel {
  id: string;
  chatbot_id: string;
  platform: string;
  is_connected: boolean;
  config: Record<string, string> | null;
  created_at: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  page_id: string;
  page_name: string | null;
  created_at: string;
}

const channelInfo: Record<Platform, { name: string; description: string; color: string; textColor: string }> = {
  telegram: {
    name: 'تيليجرام',
    description: 'اربط بوت تيليجرام للرد على الرسائل تلقائياً',
    color: 'bg-[#0088cc]/10',
    textColor: 'text-[#0088cc]',
  },
  facebook: {
    name: 'فيسبوك ماسنجر',
    description: 'اربط صفحة فيسبوك للرد على استفسارات العملاء عبر ماسنجر',
    color: 'bg-[#0084ff]/10',
    textColor: 'text-[#0084ff]',
  },
  instagram: {
    name: 'انستغرام',
    description: 'اربط حساب انستغرام بزنس للرد على الرسائل المباشرة',
    color: 'bg-[#E4405F]/10',
    textColor: 'text-[#E4405F]',
  },
  whatsapp: {
    name: 'واتساب',
    description: 'اربط واتساب بزنس للرد على رسائل العملاء تلقائياً',
    color: 'bg-[#25D366]/10',
    textColor: 'text-[#25D366]',
  },
};

export default function ChannelsPage() {
  const { chatbot, loading: chatbotLoading } = useChatbot();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [oauthPlatform, setOauthPlatform] = useState<'facebook' | 'instagram' | 'whatsapp' | null>(null);
  const [disconnectPlatform, setDisconnectPlatform] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    if (!chatbot) return;

    try {
      // Fetch channels (telegram, legacy)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabase.auth.getSession()).data.session;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/manage-channel?action=list&chatbot_id=${chatbot.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setChannels((result.channels as Channel[]) || []);
      }

      // Fetch social connections
      const { data: connections } = await supabase
        .from('social_connections')
        .select('id, platform, page_id, page_name, created_at')
        .eq('chatbot_id', chatbot.id);

      setSocialConnections(connections || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatbot) fetchData();
  }, [chatbot]);

  const isConnected = (platform: Platform): boolean => {
    if (platform === 'telegram') {
      return channels.some((c) => c.platform === 'telegram' && c.is_connected);
    }
    return socialConnections.some((c) => c.platform === platform);
  };

  const getConnectionInfo = (platform: Platform): string | null => {
    if (platform === 'telegram') {
      const ch = channels.find((c) => c.platform === 'telegram');
      return ch?.config?.bot_username ? `@${ch.config.bot_username}` : null;
    }
    const conn = socialConnections.find((c) => c.platform === platform);
    return conn?.page_name || null;
  };

  const handleConnect = (platform: Platform) => {
    if (platform === 'telegram') {
      setTelegramDialogOpen(true);
    } else {
      setOauthPlatform(platform);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectPlatform || !chatbot) return;
    setDisconnecting(true);

    try {
      if (disconnectPlatform === 'telegram') {
        const ch = channels.find((c) => c.platform === 'telegram');
        if (ch) {
          const session = (await supabase.auth.getSession()).data.session;
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-channel?action=disconnect`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ channel_id: ch.id }),
            }
          );
        }
      } else {
        // Delete social connection
        await supabase
          .from('social_connections')
          .delete()
          .eq('chatbot_id', chatbot.id)
          .eq('platform', disconnectPlatform);

        // Also clean up channels table if needed
        const platformMap: Record<string, string> = { facebook: 'messenger', whatsapp: 'whatsapp' };
        const channelPlatform = platformMap[disconnectPlatform];
        if (channelPlatform) {
          const session = (await supabase.auth.getSession()).data.session;
          const ch = channels.find((c) => c.platform === channelPlatform);
          if (ch) {
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-channel?action=disconnect`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session?.access_token}`,
                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ channel_id: ch.id }),
              }
            );
          }
        }
      }

      toast({ title: 'تم إلغاء الربط', description: `تم إلغاء ربط ${channelInfo[disconnectPlatform].name}` });
      fetchData();
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إلغاء الربط', variant: 'destructive' });
    } finally {
      setDisconnectPlatform(null);
      setDisconnecting(false);
    }
  };

  if (chatbotLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const platforms: Platform[] = ['telegram', 'facebook', 'instagram', 'whatsapp'];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">القنوات</h1>
        <p className="mt-1 text-muted-foreground">اربط الشات بوت بمنصات المراسلة</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {platforms.map((platform) => {
          const info = channelInfo[platform];
          const connected = isConnected(platform);
          const connInfo = getConnectionInfo(platform);

          return (
            <div key={platform} className="card-elevated p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${info.color}`}>
                    <Share2 className={`h-6 w-6 ${info.textColor}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{info.name}</h3>
                    <StatusBadge status={connected ? 'connected' : 'disconnected'} className="mt-1" />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{info.description}</p>

              {connected && connInfo && (
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-muted-foreground">
                    {platform === 'telegram' ? 'البوت' : platform === 'whatsapp' ? 'الرقم' : 'الحساب'}:{' '}
                    <span className="font-medium text-foreground" dir="ltr">{connInfo}</span>
                  </p>
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                {connected ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleConnect(platform)}>
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDisconnectPlatform(platform)}
                    >
                      <Unlink className="ml-2 h-4 w-4" />
                      إلغاء الربط
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleConnect(platform)}>
                    <ExternalLink className="ml-2 h-4 w-4" />
                    ربط
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telegram Dialog */}
      {chatbot && (
        <TelegramConnectDialog
          open={telegramDialogOpen}
          onOpenChange={setTelegramDialogOpen}
          chatbotId={chatbot.id}
          existingChannel={channels.find((c) => c.platform === 'telegram') as any}
          onSuccess={fetchData}
        />
      )}

      {/* Unified OAuth Dialog */}
      {chatbot && oauthPlatform && (
        <OAuthConnectDialog
          open={!!oauthPlatform}
          onOpenChange={(open) => { if (!open) setOauthPlatform(null); }}
          platform={oauthPlatform}
          chatbotId={chatbot.id}
          onSuccess={fetchData}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectPlatform} onOpenChange={() => setDisconnectPlatform(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء الربط</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء ربط {disconnectPlatform && channelInfo[disconnectPlatform].name}؟
              سيتوقف الشات بوت عن الرد على الرسائل من هذه القناة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={disconnecting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إلغاء الربط...
                </>
              ) : (
                'إلغاء الربط'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
