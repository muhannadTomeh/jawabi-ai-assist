import { Link } from 'react-router-dom';
import { MessageSquare, Users, TrendingUp, ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChatbotCard } from '@/components/dashboard/ChatbotCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { mockChatbot, mockAnalytics, mockChannels } from '@/data/mockData';

export default function DashboardPage() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">لوحة التحكم</h1>
        <p className="mt-1 text-muted-foreground">
          إدارة الشات بوت ومتابعة الأداء
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي الرسائل"
          value={mockAnalytics.totalMessages.toLocaleString('ar-SA')}
          icon={MessageSquare}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="التحويلات للدعم"
          value={mockAnalytics.handovers}
          icon={Users}
          description="هذا الأسبوع"
        />
        <StatCard
          title="نسبة الحل"
          value="٩٦.٥٪"
          icon={TrendingUp}
          trend={{ value: 2.3, isPositive: true }}
        />
        <StatCard
          title="القنوات النشطة"
          value={mockChannels.filter(c => c.isConnected).length}
          icon={Share2}
          description={`من ${mockChannels.length} قنوات`}
        />
      </div>

      {/* Chatbot Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">الشات بوت الخاص بك</h2>
        </div>
        <ChatbotCard chatbot={mockChatbot} />
      </section>

      {/* Quick Links */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Channels Overview */}
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
            {mockChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-foreground">
                    {channel.platform === 'telegram' ? 'تيليجرام' : 'ماسنجر'}
                  </span>
                </div>
                <StatusBadge status={channel.isConnected ? 'connected' : 'disconnected'} />
              </div>
            ))}
          </div>
        </div>

        {/* Top Questions */}
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
          <div className="space-y-3">
            {mockAnalytics.topQuestions.slice(0, 4).map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <span className="truncate text-sm text-foreground">{item.question}</span>
                <span className="mr-2 shrink-0 text-sm font-medium text-muted-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
