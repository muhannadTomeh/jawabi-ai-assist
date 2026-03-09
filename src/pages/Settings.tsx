import { useState, useEffect } from 'react';
import { Save, Bot, MessageSquare, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatbot } from '@/hooks/useChatbot';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { chatbot, loading, updateChatbot } = useChatbot();
  const [saving, setSaving] = useState(false);

  const [botName, setBotName] = useState('');
  const [language, setLanguage] = useState('العربية');
  const [tone, setTone] = useState('professional');
  const [dialect, setDialect] = useState('formal');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  const [handoverEnabled, setHandoverEnabled] = useState(true);
  const [lowConfidence, setLowConfidence] = useState(true);
  const [keywords, setKeywords] = useState('بشري، موظف، مساعدة، دعم');
  const [handoverMessage, setHandoverMessage] = useState('');

  useEffect(() => {
    if (chatbot) {
      setBotName(chatbot.name);
      setLanguage(chatbot.language);
      setTone(chatbot.tone);
      setDialect((chatbot as any).dialect || 'formal');
      setFallbackMessage(chatbot.fallback_message);
      setWelcomeMessage((chatbot as any).welcome_message || '');
      setCustomInstructions((chatbot as any).custom_instructions || '');
    }
  }, [chatbot]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateChatbot({
      name: botName,
      language,
      tone,
      dialect,
      fallback_message: fallbackMessage,
      welcome_message: welcomeMessage,
      custom_instructions: customInstructions,
    } as any);
    setSaving(false);
    if (result?.success) {
      toast.success('تم حفظ الإعدادات بنجاح');
    } else {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الإعدادات</h1>
          <p className="mt-1 text-muted-foreground">
            تخصيص سلوك الشات بوت وردوده
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Bot className="h-4 w-4" />
            عام
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            التحويل للدعم
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="card-elevated p-6">
            <h3 className="mb-6 flex items-center gap-2 font-semibold text-foreground">
              <Bot className="h-5 w-5 text-primary" />
              إعدادات البوت
            </h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">اسم البوت</Label>
                <Input
                  id="name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="مثال: مساعد الدعم"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">اللغة</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="العربية">العربية</SelectItem>
                    <SelectItem value="الإنجليزية">الإنجليزية</SelectItem>
                    <SelectItem value="الفرنسية">الفرنسية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">نبرة المحادثة</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">احترافي</SelectItem>
                    <SelectItem value="friendly">ودود</SelectItem>
                    <SelectItem value="casual">عفوي</SelectItem>
                    <SelectItem value="formal">رسمي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialect">لهجة البوت</Label>
                <Select value={dialect} onValueChange={setDialect}>
                  <SelectTrigger id="dialect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">عربية فصحى / رسمية</SelectItem>
                    <SelectItem value="palestinian">عامية فلسطينية</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  حدد اللهجة التي سيتحدث بها البوت مع المستخدمين.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="welcome">رسالة الترحيب</Label>
                <Textarea
                  id="welcome"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={2}
                  placeholder="مثال: مرحباً! كيف يمكنني مساعدتك اليوم؟"
                />
                <p className="text-xs text-muted-foreground">
                  هذه الرسالة تُرسل تلقائياً عند بدء محادثة جديدة مع البوت.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fallback">رسالة عدم الفهم</Label>
                <Textarea
                  id="fallback"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  rows={2}
                  placeholder="الرسالة التي تظهر عندما لا يفهم البوت السؤال..."
                />
                <p className="text-xs text-muted-foreground">
                  هذه الرسالة تُرسل عندما لا يستطيع الشات بوت فهم طلب المستخدم.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="instructions">تعليمات إضافية للبوت</Label>
                <Textarea
                  id="instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={4}
                  placeholder="مثال: إذا سأل المستخدم عن الأسعار، وجّهه للتواصل مع المبيعات. لا تجب عن الأسئلة السياسية..."
                />
                <p className="text-xs text-muted-foreground">
                  أوامر وتعليمات مخصصة تحدد كيف يتعامل البوت مع الأسئلة خارج قاعدة المعرفة.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Handover Settings */}
        <TabsContent value="handover" className="space-y-6">
          <div className="card-elevated p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">التحويل للدعم البشري</h3>
              </div>
              <Switch
                checked={handoverEnabled}
                onCheckedChange={setHandoverEnabled}
              />
            </div>

            <div className={handoverEnabled ? 'space-y-6' : 'pointer-events-none opacity-50 space-y-6'}>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium text-foreground">التحويل عند انخفاض الثقة</p>
                  <p className="text-sm text-muted-foreground">
                    تحويل المحادثة عندما يكون البوت غير متأكد من الرد
                  </p>
                </div>
                <Switch
                  checked={lowConfidence}
                  onCheckedChange={setLowConfidence}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">كلمات التحويل</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="بشري، موظف، دعم"
                />
                <p className="text-xs text-muted-foreground">
                  كلمات مفصولة بفواصل تؤدي إلى التحويل عند اكتشافها
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="handoverMsg">رسالة التحويل</Label>
                <Textarea
                  id="handoverMsg"
                  value={handoverMessage}
                  onChange={(e) => setHandoverMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  الرسالة المرسلة للمستخدم عند تحويله لموظف الدعم
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
