import { useState } from "react";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Check, Trash2, MessageCircleReply, ShoppingCart, HelpCircle, UserCog, Send } from "lucide-react";
import { Loader2 } from "lucide-react";

const typeMeta: Record<string, { icon: typeof Bell; color: string }> = {
  sale: { icon: ShoppingCart, color: "text-emerald-600 bg-emerald-50" },
  unclear: { icon: HelpCircle, color: "text-amber-600 bg-amber-50" },
  human_request: { icon: UserCog, color: "text-blue-600 bg-blue-50" },
};

const channelLabel: Record<string, string> = {
  telegram: "تلجرام",
  whatsapp: "واتساب",
  web: "الشات التجريبي",
};

export default function NotificationsPage() {
  const { notifications, loading, unreadCount, markRead, markAllRead, resolve, remove } = useNotifications();
  const [replyTarget, setReplyTarget] = useState<Notification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-telegram-reply", {
        body: {
          chatbot_id: replyTarget.chatbot_id,
          telegram_user_id: Number(replyTarget.contact_identifier),
          message: replyText.trim(),
        },
      });
      if (error) throw error;
      toast.success("تم إرسال الرد");
      await resolve(replyTarget.id);
      setReplyTarget(null);
      setReplyText("");
    } catch (e) {
      console.error(e);
      toast.error("فشل إرسال الرد");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تنبيهات تتطلب تدخلك — طلبات شراء، أسئلة غير مفهومة، طلب موظف بشري.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="shrink-0">
            <Check className="ml-2 h-4 w-4" />
            تعليم الكل كمقروء ({unreadCount})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bell className="mx-auto h-10 w-10 mb-3 opacity-40" />
          لا توجد إشعارات بعد
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const meta = typeMeta[n.type] || { icon: Bell, color: "text-muted-foreground bg-muted" };
            const Icon = meta.icon;
            return (
              <Card
                key={n.id}
                className={`p-4 transition-colors ${!n.is_read ? "border-primary/40 bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{n.title}</h3>
                      {!n.is_read && <Badge variant="default" className="text-[10px] h-5">جديد</Badge>}
                      {n.is_resolved && <Badge variant="secondary" className="text-[10px] h-5">تم المعالجة</Badge>}
                      <Badge variant="outline" className="text-[10px] h-5">{channelLabel[n.channel] || n.channel}</Badge>
                    </div>
                    {n.contact_name && (
                      <p className="text-xs text-muted-foreground mt-1">من: {n.contact_name}</p>
                    )}
                    {n.last_message && (
                      <p className="text-sm mt-2 text-foreground/80 line-clamp-2">"{n.last_message}"</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(n.created_at).toLocaleString("ar")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {n.channel === "telegram" && !n.is_resolved && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setReplyTarget(n);
                          markRead(n.id);
                        }}
                      >
                        <MessageCircleReply className="ml-1 h-4 w-4" />
                        رد
                      </Button>
                    )}
                    {!n.is_read && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!replyTarget} onOpenChange={(o) => !o && setReplyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>الرد عبر تلجرام</DialogTitle>
          </DialogHeader>
          {replyTarget && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                إلى: <span className="text-foreground">{replyTarget.contact_name || replyTarget.contact_identifier}</span>
              </div>
              {replyTarget.last_message && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">آخر رسالة من الزبون:</p>
                  {replyTarget.last_message}
                </div>
              )}
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)} disabled={sending}>
              إلغاء
            </Button>
            <Button onClick={sendReply} disabled={sending || !replyText.trim()}>
              {sending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}