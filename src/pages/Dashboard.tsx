import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, TrendingUp, ArrowLeft, Share2, Bot, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useChatbot } from '@/hooks/useChatbot';

type PlatformKey = 'telegram' | 'facebook' | 'instagram' | 'whatsapp';

const platformLabels: Record<PlatformKey, string> = {
  telegram: 'تيليجرام',
  facebook: 'فيسبوك ماسنجر',
  instagram: 'انستغرام',
  whatsapp: 'واتساب',
};

const toneLabels: Record<string, string> = {
  professional: 'احترافي',
  friendly: 'ودود',
  casual: 'عفوي',
  formal: 'رسمي',
};

interface ChannelRow {
  platform: PlatformKey;
  connected: boolean;
}

interface TopQuestion {
  question: string;
  count: number;
}

export default function DashboardPage() {
  const { chatbot, loading: chatbotLoading } = useChatbot();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [userMessages, setUserMessages] = useState(0);
  const [uniqueContacts, setUniqueContacts] = useState(0);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);

  useEffect(() => {
    if (!chatbot) return;
    const load = async () => {
      setLoading(true);
      try {
        const [tgChRes, socialRes, webMsgRes, tgMsgRes, waMsgRes, waContactsRes, tgUsersRes] = await Promise.all([
          supabase.from('channels').select('platform, is_connected').eq('chatbot_id', chatbot.id),
          supabase.from('social_connections').select('platform').eq('chatbot_id', chatbot.id),
          supabase.from('web_chat_messages').select('content, role').eq('chatbot_id', chatbot.id),
          supabase.from('telegram_messages').select('content, role, telegram_user_id').eq('chatbot_id', chatbot.id),
          supabase.from('whatsapp_messages').select('content, role, phone_number').eq('chatbot_id', chatbot.id),
          supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbot.id),
          supabase.from('telegram_users').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbot.id),
        ]);

        // Channels: combine legacy `channels` (telegram) with social_connections (fb/ig/wa)
        const map: Record<PlatformKey, boolean> = {
          telegram: false,
          facebook: false,
          instagram: false,
          whatsapp: false,
        };
        (tgChRes.data || []).forEach((c: any) => {
          if (c.platform === 'telegram') map.telegram = !!c.is_connected;
        });
        (socialRes.data || []).forEach((c: any) => {
          if (c.platform in map) map[c.platform as PlatformKey] = true;
        });
        setChannels(
          (Object.keys(map) as PlatformKey[]).map((p) => ({ platform: p, connected: map[p] }))
        );

        const web = webMsgRes.data || [];
        const tg = tgMsgRes.data || [];
        const wa = waMsgRes.data || [];

        const allMessages = [...web, ...tg, ...wa];
        setTotalMessages(allMessages.length);

        const userMsgs = allMessages.filter((m: any) => m.role === 'user');
        setUserMessages(userMsgs.length);

        // Unique contacts: whatsapp_contacts + telegram_users + unique web user_ids
        const webUserIds = new Set((web as any[]).map((m: any) => m.user_id).filter(Boolean));
        const total =
          (waContactsRes.count || 0) +
          (tgUsersRes.count || 0) +
          webUserIds.size;
        setUniqueContacts(total);

        // Top questions: count user messages by content (trimmed, lowered)
        const counts = new Map<string, number>();
        userMsgs.forEach((m: any) => {
          const k = (m.content || '').trim();
          if (!k) return;
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        const top = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([question, count]) => ({ question, count }));
        setTopQuestions(top);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chatbot]);

  if (chatbotLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const connectedCount = channels.filter((c) => c.connected).length;

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">لوحة التحكم</h1>
        <p className="mt-1 text-muted-foreground">إدارة الشات بوت ومتابعة الأداء</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي الرسائل"
          value={totalMessages.toLocaleString('ar-SA')}
          icon={MessageSquare}
          description="عبر جميع القنوات"
        />
        <StatCard
          title="رسائل المستخدمين"
          value={userMessages.toLocaleString('ar-SA')}
          icon={MessageSquare}
        />
        <StatCard
          title="جهات الاتصال"
          value={uniqueContacts.toLocaleString('ar-SA')}
          icon={Users}
          description="إجمالي المتفاعلين"
        />
        <StatCard
          title="القنوات النشطة"
          value={connectedCount}
          icon={Share2}
          description={`من ${channels.length} قنوات`}
        />
      </div>

      {chatbot && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">الشات بوت الخاص بك</h2>
          </div>
          <div className="card-elevated p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{chatbot.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {chatbot.language} • نبرة {toneLabels[chatbot.tone] || chatbot.tone}
                  </p>
                </div>
              </div>
              <StatusBadge status={chatbot.is_active ? 'active' : 'inactive'} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/settings">
                  <Settings className="ml-2 h-4 w-4" />
                  إعدادات
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/dashboard/test">
                  <MessageSquare className="ml-2 h-4 w-4" />
                  تجربة الشات
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">القنوات المتصلة</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/channels">
                عرض الكل
                <ArrowLeft className="mr-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {channels.map((c) => (
              <div
                key={c.platform}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-foreground">{platformLabels[c.platform]}</span>
                </div>
                <StatusBadge status={c.connected ? 'connected' : 'disconnected'} />
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">الأسئلة الأكثر شيوعاً</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/analytics">
                الإحصائيات
                <ArrowLeft className="mr-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {topQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
          ) : (
            <div className="space-y-3">
              {topQuestions.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <span className="truncate text-sm text-foreground">{item.question}</span>
                  <span className="mr-2 shrink-0 text-sm font-medium text-muted-foreground">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
