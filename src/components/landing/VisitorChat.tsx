import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SUGGESTIONS = [
  "ما هي منصة جوابي؟",
  "كيف أبدأ تجربة مجانية؟",
  "أي قنوات تدعمونها؟",
  "هل يدعم اللهجات العربية؟",
];

export function VisitorChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "أهلاً بك في جوابي 👋 أنا مساعدك الذكي، اسألني أي شيء عن المنصة.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/visitor-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "حدث خطأ");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `تعذّر الرد حالياً. ${e?.message ?? ""}`.trim() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="افتح الدردشة"
        className={cn(
          "fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-all hover:scale-105",
          open && "rotate-90"
        )}
        style={{ background: "var(--gradient-primary)" }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      <div
        dir="rtl"
        className={cn(
          "fixed bottom-24 left-6 z-50 flex w-[min(380px,calc(100vw-3rem))] origin-bottom-left flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200",
          open
            ? "h-[540px] max-h-[calc(100vh-7rem)] scale-100 opacity-100"
            : "pointer-events-none h-0 scale-95 opacity-0"
        )}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">مساعد جوابي</div>
            <div className="flex items-center gap-1.5 text-xs opacity-90">
              <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
              متصل الآن
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-tr-sm bg-card text-foreground shadow-sm border border-border"
                    : "rounded-tl-sm bg-primary text-primary-foreground shadow-sm"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tl-sm bg-primary px-3.5 py-2 text-primary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {messages.length <= 1 && !loading && (
            <div className="flex flex-wrap gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-border bg-card p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}