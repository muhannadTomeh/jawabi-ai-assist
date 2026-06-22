import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

function getGuestId(slug: string) {
  const key = `jawabi_guest_${slug}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export default function PublicChat() {
  const { slug = '' } = useParams();
  const [bot, setBot] = useState<{ id: string; name: string; welcome_message: string; fallback_message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_chatbot_by_slug', { _slug: slug });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setNotFound(true);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setBot(row);
        setMessages([
          {
            role: 'assistant',
            content: row.welcome_message || `أهلاً بك في ${row.name} 👋`,
          },
        ]);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !bot) return;
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const guestId = getGuestId(slug);
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: trimmed, public_slug: slug, user_id: guestId },
      });
      if (error) throw error;
      setMessages((m) => [...m, { role: 'assistant', content: data.response || bot.fallback_message }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: bot.fallback_message }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !bot) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الشات بوت غير متاح</h1>
          <p className="mt-2 text-muted-foreground">الرابط غير صحيح أو تم تعطيل البوت.</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-secondary/30">
      <header
        className="flex items-center gap-3 px-4 py-3 text-primary-foreground shadow"
        style={{ background: 'var(--gradient-primary)' }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{bot.name}</div>
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
            متصل الآن
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm',
                m.role === 'user'
                  ? 'rounded-tr-sm border border-border bg-card text-foreground'
                  : 'rounded-tl-sm bg-primary text-primary-foreground'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tl-sm bg-primary px-4 py-2 text-primary-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-border bg-card p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب رسالتك..."
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}