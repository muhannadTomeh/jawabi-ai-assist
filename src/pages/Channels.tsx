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
import { MessengerConnectDialog } from '@/components/channels/MessengerConnectDialog';

interface Channel {
  id: string;
  chatbot_id: string;
  platform: 'telegram' | 'messenger';
  is_connected: boolean;
  config: Record<string, string> | null;
  created_at: string;
}

const channelInfo = {
  telegram: {
    name: 'تيليجرام',
    description: 'اربط بوت تيليجرام للرد على الرسائل تلقائياً',
    color: 'bg-[#0088cc]/10',
    textColor: 'text-[#0088cc]',
  },
  messenger: {
    name: 'فيسبوك ماسنجر',
    description: 'اربط صفحة فيسبوك للرد على استفسارات العملاء',
    color: 'bg-[#0084ff]/10',
    textColor: 'text-[#0084ff]',
  },
};

export default function ChannelsPage() {
  const { chatbot, loading: chatbotLoading } = useChatbot();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [messengerDialogOpen, setMessengerDialogOpen] = useState(false);
  const [disconnectChannel, setDisconnectChannel] = useState<Channel | null>(null);
  const { toast } = useToast();

  const fetchChannels = async () => {
    if (!chatbot) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('chatbot_id', chatbot.id);

      if (error) throw error;

      setChannels((data as Channel[]) || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatbot) {
      fetchChannels();
    }
  }, [chatbot]);

  const getChannel = (platform: 'telegram' | 'messenger') => {
    return channels.find((c) => c.platform === platform);
  };

  const handleDisconnect = async () => {
    if (!disconnectChannel) return;

    try {
      // If Telegram, remove webhook
      if (disconnectChannel.platform === 'telegram' && disconnectChannel.config?.bot_token) {
        await fetch(
          `https://api.telegram.org/bot${disconnectChannel.config.bot_token}/deleteWebhook`
        );
      }

      // Update channel in database
      const { error } = await supabase
        .from('channels')
        .update({ is_connected: false, config: null })
        .eq('id', disconnectChannel.id);

      if (error) throw error;

      toast({
        title: 'تم إلغاء الربط',
        description: `تم إلغاء ربط ${channelInfo[disconnectChannel.platform].name}`,
      });

      fetchChannels();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إلغاء الربط',
        variant: 'destructive',
      });
    } finally {
      setDisconnectChannel(null);
    }
  };

  const handleConnect = (platform: 'telegram' | 'messenger') => {
    if (platform === 'telegram') {
      setTelegramDialogOpen(true);
    } else {
      setMessengerDialogOpen(true);
    }
  };

  if (chatbotLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const platforms: Array<'telegram' | 'messenger'> = ['telegram', 'messenger'];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">القنوات</h1>
        <p className="mt-1 text-muted-foreground">
          اربط الشات بوت بمنصات المراسلة
        </p>
      </div>

      {/* Channel Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {platforms.map((platform) => {
          const info = channelInfo[platform];
          const channel = getChannel(platform);
          const isConnected = channel?.is_connected || false;

          return (
            <div key={platform} className="card-elevated p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${info.color}`}>
                    <Share2 className={`h-6 w-6 ${info.textColor}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{info.name}</h3>
                    <StatusBadge
                      status={isConnected ? 'connected' : 'disconnected'}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{info.description}</p>

              {isConnected && channel?.config && (
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                  {platform === 'telegram' && channel.config.bot_username && (
                    <p className="text-muted-foreground">
                      البوت: <span className="font-medium text-foreground" dir="ltr">@{channel.config.bot_username}</span>
                    </p>
                  )}
                  {platform === 'messenger' && (channel.config.page_name || channel.config.page_id) && (
                    <p className="text-muted-foreground">
                      الصفحة: <span className="font-medium text-foreground">{channel.config.page_name || channel.config.page_id}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                {isConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(platform)}
                    >
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDisconnectChannel(channel!)}
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

      {/* Coming Soon */}
      <div className="card-elevated border-dashed p-6">
        <h3 className="font-semibold text-foreground">قنوات قادمة قريباً</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          واتساب، انستجرام، والمزيد من القنوات في خطة التطوير.
        </p>
      </div>

      {/* Telegram Dialog */}
      {chatbot && (
        <TelegramConnectDialog
          open={telegramDialogOpen}
          onOpenChange={setTelegramDialogOpen}
          chatbotId={chatbot.id}
          existingChannel={getChannel('telegram')}
          onSuccess={fetchChannels}
        />
      )}

      {/* Messenger Dialog */}
      {chatbot && (
        <MessengerConnectDialog
          open={messengerDialogOpen}
          onOpenChange={setMessengerDialogOpen}
          chatbotId={chatbot.id}
          existingChannel={getChannel('messenger')}
          onSuccess={fetchChannels}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectChannel} onOpenChange={() => setDisconnectChannel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء الربط</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء ربط {disconnectChannel && channelInfo[disconnectChannel.platform].name}؟
              سيتوقف الشات بوت عن الرد على الرسائل من هذه القناة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              إلغاء الربط
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
