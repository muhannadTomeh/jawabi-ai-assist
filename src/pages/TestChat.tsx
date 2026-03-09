import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useChatbot } from '@/hooks/useChatbot';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export default function TestChatPage() {
  const { chatbot, loading: chatbotLoading } = useChatbot();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB on mount
  useEffect(() => {
    async function loadHistory() {
      if (!chatbot || !user || historyLoaded) return;

      const { data } = await supabase
        .from('web_chat_messages')
        .select('id, role, content, created_at')
        .eq('chatbot_id', chatbot.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      setHistoryLoaded(true);

      if (data && data.length > 0) {
        const loaded: Message[] = data.map((m) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'bot' : 'user',
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loaded);
      } else {
        // No history → show welcome message (not saved)
        setMessages([
          {
            id: 'welcome',
            role: 'bot',
            content: chatbot.welcome_message || 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
            timestamp: new Date(),
          },
        ]);
      }
    }

    loadHistory();
  }, [chatbot, user, historyLoaded]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearHistory = async () => {
    if (!chatbot || !user) return;
    setClearing(true);
    try {
      await supabase
        .from('web_chat_messages')
        .delete()
        .eq('chatbot_id', chatbot.id)
        .eq('user_id', user.id);

      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          content: chatbot.welcome_message || 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
          timestamp: new Date(),
        },
      ]);
      toast({ title: 'تم مسح المحادثة', description: 'بدأت محادثة جديدة' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر مسح المحادثة', variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatbot || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: currentInput,
          chatbot_id: chatbot.id,
          user_id: user?.id,
          conversation_history: [],
        },
      });

      if (error) throw error;

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: data?.response || chatbot.fallback_message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: 'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  if (chatbotLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex h-[calc(100vh-8rem)] flex-col" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">تجربة الشات</h1>
          <p className="mt-1 text-muted-foreground">
            اختبر ردود الشات بوت بناءً على قاعدة المعرفة الفعلية
          </p>
        </div>
        {messages.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={clearing}
            className="gap-2 text-destructive hover:text-destructive"
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            مسح المحادثة
          </Button>
        )}
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
                  message.role === 'bot' ? 'bg-primary/10' : 'bg-muted'
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
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="mt-1 text-[10px] opacity-50">
                  {message.timestamp.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
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
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
