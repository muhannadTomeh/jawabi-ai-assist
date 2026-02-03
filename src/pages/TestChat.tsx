import { useState } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'bot',
    content: 'مرحباً! أنا مساعد الدعم الخاص بك. كيف يمكنني مساعدتك اليوم؟',
    timestamp: new Date(),
  },
];

export default function TestChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: getBotResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  const getBotResponse = (userInput: string): string => {
    const lower = userInput.toLowerCase();
    
    if (lower.includes('ساعات') || lower.includes('مواعيد') || lower.includes('دوام')) {
      return 'نحن متاحون من الأحد إلى الخميس، من الساعة ٩ صباحاً حتى ٦ مساءً. هل هناك شيء آخر يمكنني مساعدتك به؟';
    }
    if (lower.includes('استرجاع') || lower.includes('إرجاع') || lower.includes('استرداد')) {
      return 'نقدم ضمان استرداد الأموال خلال ٣٠ يوماً على جميع المنتجات. هل تريد أن أساعدك في إجراء طلب إرجاع؟';
    }
    if (lower.includes('بشري') || lower.includes('موظف') || lower.includes('إنسان')) {
      return 'سأقوم بتحويلك إلى أحد أعضاء فريقنا للمساعدة. يرجى الانتظار لحظة.';
    }
    
    return 'أفهم استفسارك. بناءً على قاعدة المعرفة لدينا، يسعدني مساعدتك. هل يمكنك تقديم المزيد من التفاصيل حول سؤالك؟';
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">تجربة الشات</h1>
        <p className="mt-1 text-muted-foreground">
          اختبر ردود الشات بوت في بيئة تجريبية
        </p>
      </div>

      {/* Chat Container */}
      <div className="card-elevated flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex items-start gap-3',
                message.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  message.role === 'bot'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                )}
              >
                {message.role === 'bot' ? (
                  <Bot className="h-4 w-4 text-primary" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[70%] rounded-2xl px-4 py-2.5',
                  message.role === 'bot'
                    ? 'bg-muted text-foreground'
                    : 'bg-primary text-primary-foreground'
                )}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالة..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
