import { Link } from 'react-router-dom';
import { MessageSquare, Users, TrendingUp, ArrowUpRight, Share2 } from 'lucide-react';
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
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your chatbot and monitor performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Messages"
          value={mockAnalytics.totalMessages.toLocaleString()}
          icon={MessageSquare}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Handovers"
          value={mockAnalytics.handovers}
          icon={Users}
          description="This week"
        />
        <StatCard
          title="Resolution Rate"
          value="96.5%"
          icon={TrendingUp}
          trend={{ value: 2.3, isPositive: true }}
        />
        <StatCard
          title="Active Channels"
          value={mockChannels.filter(c => c.isConnected).length}
          icon={Share2}
          description={`of ${mockChannels.length} configured`}
        />
      </div>

      {/* Chatbot Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your Chatbot</h2>
        </div>
        <ChatbotCard chatbot={mockChatbot} />
      </section>

      {/* Quick Links */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Channels Overview */}
        <div className="card-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Connected Channels</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/channels">
                View all
                <ArrowUpRight className="ml-1 h-4 w-4" />
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
                  <span className="font-medium capitalize text-foreground">
                    {channel.platform}
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
            <h3 className="font-semibold text-foreground">Top Questions</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/analytics">
                View analytics
                <ArrowUpRight className="ml-1 h-4 w-4" />
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
                <span className="ml-2 shrink-0 text-sm font-medium text-muted-foreground">
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
