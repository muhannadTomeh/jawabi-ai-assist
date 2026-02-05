import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bot, MessageSquare, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  totalUsers: number;
  totalChatbots: number;
  activeChatbots: number;
  totalChannels: number;
  totalKnowledgeItems: number;
}

export function AdminStats() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalChatbots: 0,
    activeChatbots: 0,
    totalChannels: 0,
    totalKnowledgeItems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [profilesRes, chatbotsRes, channelsRes, knowledgeRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('chatbots').select('id, is_active'),
          supabase.from('channels').select('id', { count: 'exact', head: true }),
          supabase.from('knowledge_items').select('id', { count: 'exact', head: true }),
        ]);

        const chatbots = chatbotsRes.data || [];
        
        setStats({
          totalUsers: profilesRes.count || 0,
          totalChatbots: chatbots.length,
          activeChatbots: chatbots.filter(c => c.is_active).length,
          totalChannels: channelsRes.count || 0,
          totalKnowledgeItems: knowledgeRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'إجمالي المستخدمين',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'إجمالي الشات بوتات',
      value: stats.totalChatbots,
      icon: Bot,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'الشات بوتات النشطة',
      value: stats.activeChatbots,
      icon: MessageSquare,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'القنوات المتصلة',
      value: stats.totalChannels,
      icon: Share2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-8 w-8 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
