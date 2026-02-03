import { Bot, Settings, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import type { Chatbot } from '@/types';

interface ChatbotCardProps {
  chatbot: Chatbot;
}

export function ChatbotCard({ chatbot }: ChatbotCardProps) {
  const toneLabels: Record<string, string> = {
    professional: 'احترافي',
    friendly: 'ودود',
    casual: 'عفوي',
    formal: 'رسمي',
  };

  return (
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
        <StatusBadge status={chatbot.isActive ? 'active' : 'inactive'} />
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
  );
}
