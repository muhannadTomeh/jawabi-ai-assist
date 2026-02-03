import { BarChart3, MessageSquare, TrendingUp, Share2 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { mockAnalytics } from '@/data/mockData';

export default function AnalyticsPage() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الإحصائيات</h1>
        <p className="mt-1 text-muted-foreground">
          تتبع أداء الشات بوت والتفاعل
        </p>
      </div>

      {/* Stats */}
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
          icon={TrendingUp}
          trend={{ value: -5, isPositive: true }}
        />
        <StatCard
          title="متوسط وقت الرد"
          value="١.٢ ثانية"
          icon={BarChart3}
        />
        <StatCard
          title="القنوات النشطة"
          value="٢"
          icon={Share2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Questions */}
        <div className="card-elevated p-6">
          <h3 className="mb-4 font-semibold text-foreground">الأسئلة الأكثر شيوعاً</h3>
          <div className="space-y-3">
            {mockAnalytics.topQuestions.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(index + 1).toLocaleString('ar-SA')}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {item.question}
                </span>
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Topics */}
        <div className="card-elevated p-6">
          <h3 className="mb-4 font-semibold text-foreground">المواضيع الشائعة</h3>
          <div className="space-y-3">
            {mockAnalytics.topTopics.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {item.topic}
                </span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(item.count / mockAnalytics.topTopics[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-left text-sm text-muted-foreground">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Usage */}
        <div className="card-elevated p-6 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-foreground">توزيع القنوات</h3>
          <div className="flex flex-wrap gap-6">
            {mockAnalytics.channelUsage.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.channel === 'Telegram' ? 'تيليجرام' : 'ماسنجر'}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">{item.count}</p>
                  <p className="text-xs text-muted-foreground">رسالة</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
