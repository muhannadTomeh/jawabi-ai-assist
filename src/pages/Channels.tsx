import { Share2, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { mockChannels } from '@/data/mockData';

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
        {mockChannels.map((channel) => {
          const info = channelInfo[channel.platform];
          return (
            <div key={channel.id} className="card-elevated p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${info.color}`}>
                    <Share2 className={`h-6 w-6 ${info.textColor}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{info.name}</h3>
                    <StatusBadge
                      status={channel.isConnected ? 'connected' : 'disconnected'}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{info.description}</p>

              <div className="mt-6 flex items-center gap-3">
                {channel.isConnected ? (
                  <>
                    <Button variant="outline" size="sm">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      إلغاء الربط
                    </Button>
                  </>
                ) : (
                  <Button size="sm">
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
    </div>
  );
}
