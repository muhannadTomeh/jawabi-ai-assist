import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChatbot } from '@/hooks/useChatbot';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2, Sparkles, CheckCircle2, ArrowLeft, Building2, Upload, Link as LinkIcon,
  MessageSquare, Bot, Share2, Rocket, SkipForward, Globe, FileText, Image as ImageIcon,
} from 'lucide-react';

const CATEGORIES = [
  'متجر إلكتروني', 'مطعم', 'عيادة طبية', 'تعليم وتدريب',
  'خدمات', 'سياحة وسفر', 'عقارات', 'أخرى',
];

const PRESETS = [
  { id: 'support', label: 'دعم العملاء', prompt: 'أنت مساعد دعم العملاء لهذا النشاط. أجب عن أسئلة العملاء بدقة باستخدام البيانات المتوفرة، وحافظ على نبرة احترافية ومهذبة.' },
  { id: 'sales', label: 'مساعد مبيعات', prompt: 'أنت مساعد مبيعات. ساعد العملاء على اختيار المنتج المناسب، اعرض المزايا والأسعار، واقترح المنتجات ذات الصلة بأسلوب ودود ومقنع.' },
  { id: 'booking', label: 'مساعد حجوزات', prompt: 'أنت مساعد حجوزات. ساعد العملاء على حجز المواعيد، تأكيد التفاصيل، والإجابة على استفساراتهم حول الأوقات المتاحة والخدمات.' },
  { id: 'tech', label: 'دعم تقني', prompt: 'أنت مساعد دعم تقني. ساعد المستخدمين على حل المشاكل التقنية خطوة بخطوة بأسلوب واضح ومبسط.' },
  { id: 'restaurant', label: 'مساعد مطعم', prompt: 'أنت مساعد مطعم. ساعد العملاء على تصفح القائمة، تقديم الطلبات، الإجابة عن مكونات الأطباق، وحجز الطاولات.' },
];

function slugify(text: string) {
  return (text || 'bot')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'bot';
}

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { chatbot, loading: botLoading, updateChatbot } = useChatbot();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [bizName, setBizName] = useState('');
  const [bizCat, setBizCat] = useState('');
  const [bizLoc, setBizLoc] = useState('');
  const [bizDesc, setBizDesc] = useState('');

  // Step 2
  const [knowledgeText, setKnowledgeText] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [trainingProgress, setTrainingProgress] = useState(0);

  // Step 4
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (chatbot) {
      setBizName(chatbot.business_name || '');
      setBizCat(chatbot.business_category || '');
      setBizLoc(chatbot.business_location || '');
      setBizDesc(chatbot.business_description || '');
      setInstructions(chatbot.custom_instructions || '');
      if (chatbot.onboarding_completed) {
        navigate('/dashboard', { replace: true });
      } else if (chatbot.onboarding_step && chatbot.onboarding_step > 1) {
        setStep(chatbot.onboarding_step);
      }
    }
  }, [chatbot, navigate]);

  const progress = useMemo(() => Math.min(100, (step - 1) * 25), [step]);

  if (authLoading || botLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const goNext = async (data: Partial<any> = {}, nextStep?: number) => {
    if (!chatbot) return;
    setSaving(true);
    const target = nextStep ?? step + 1;
    const res = await updateChatbot({ ...data, onboarding_step: target });
    setSaving(false);
    if (res?.success) setStep(target);
    else toast.error('فشل الحفظ، حاول مجدداً');
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !bizCat.trim()) {
      toast.error('يرجى تعبئة الحقول المطلوبة');
      return;
    }
    await goNext({
      business_name: bizName.trim(),
      business_category: bizCat,
      business_location: bizLoc.trim() || null,
      business_description: bizDesc.trim() || null,
      name: bizName.trim(),
      public_slug: chatbot?.public_slug || `${slugify(bizName)}-${(chatbot?.id || '').slice(0, 6)}`,
    });
  };

  const handleTrainingSave = async () => {
    if (!chatbot) return;
    setSaving(true);
    setTrainingProgress(25);
    try {
      const items: any[] = [];
      if (knowledgeText.trim()) items.push({ chatbot_id: chatbot.id, source_type: 'text', title: 'معلومات عامة', content: knowledgeText.trim(), status: 'ready' });
      setTrainingProgress(50);
      if (websiteUrl.trim()) items.push({ chatbot_id: chatbot.id, source_type: 'url', title: websiteUrl.trim(), content: websiteUrl.trim(), status: 'pending' });
      if (socialLink.trim()) items.push({ chatbot_id: chatbot.id, source_type: 'social', title: socialLink.trim(), content: socialLink.trim(), status: 'pending' });
      setTrainingProgress(75);
      if (items.length) {
        const { error } = await supabase.from('knowledge_items').insert(items);
        if (error) throw error;
      }
      setTrainingProgress(100);
      await goNext();
    } catch (err: any) {
      toast.error('فشل حفظ بيانات التدريب', { description: err?.message });
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!chatbot) return;
    setSaving(true);
    const res = await updateChatbot({
      custom_instructions: instructions.trim() || chatbot.custom_instructions,
      onboarding_completed: true,
      onboarding_step: 5,
      is_active: true,
    });
    setSaving(false);
    if (res?.success) setStep(5);
    else toast.error('فشل التفعيل');
  };

  const publicUrl = chatbot?.public_slug
    ? `${window.location.origin}/chat/${chatbot.public_slug}`
    : '';

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('تم نسخ الرابط');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            مساعدك الذكي جاهز
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            تم إنشاء البوت تلقائياً. أكمل الإعداد لتفعيله بالكامل أو تابع لاحقاً.
          </p>
        </div>

        {/* Progress */}
        {step < 5 && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>الخطوة {step} من 4</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">عرّفنا على نشاطك</h2>
                <p className="text-sm text-muted-foreground">معلومات أساسية تساعد البوت على فهم سياق عملك</p>
              </div>
            </div>

            <form onSubmit={handleStep1} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="bn">اسم النشاط <span className="text-destructive">*</span></Label>
                <Input id="bn" value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="مثال: متجر النور" required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>فئة النشاط <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBizCat(c)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        bizCat === c
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bl">الموقع (المدينة / الدولة)</Label>
                <Input id="bl" value={bizLoc} onChange={(e) => setBizLoc(e.target.value)} placeholder="الرياض، السعودية" maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bd">وصف مختصر</Label>
                <Textarea id="bd" value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} placeholder="نبذة قصيرة عن نشاطك ومنتجاتك..." maxLength={500} rows={3} />
              </div>
              <Button type="submit" className="w-full h-11" disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                متابعة
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </form>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">درّب مساعدك</h2>
                <p className="text-sm text-muted-foreground">كلما أضفت بيانات أكثر، أصبح مساعدك أذكى</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="kt" className="flex items-center gap-2"><FileText className="h-4 w-4" /> معلومات نصية</Label>
                <Textarea id="kt" value={knowledgeText} onChange={(e) => setKnowledgeText(e.target.value)} placeholder="الأسئلة الشائعة، سياسات الإرجاع، ساعات العمل..." rows={4} maxLength={5000} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wu" className="flex items-center gap-2"><Globe className="h-4 w-4" /> رابط الموقع</Label>
                <Input id="wu" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sl" className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> رابط وسائل التواصل</Label>
                <Input id="sl" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="https://instagram.com/your-account" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> ملفات (PDF، Word، صور)</Label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
                  <Upload className="mb-2 h-6 w-6" />
                  <span>اسحب الملفات هنا أو اضغط للاختيار</span>
                  <span className="mt-1 text-xs">يمكنك إضافة المزيد لاحقاً من قاعدة المعرفة</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,image/*"
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">{files.length} ملف محدد — سيتم رفعها من قاعدة المعرفة</p>
                )}
              </div>

              {trainingProgress > 0 && (
                <div>
                  <Progress value={trainingProgress} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">تجهيز البيانات... {trainingProgress}%</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => goNext()} disabled={saving}>
                  <SkipForward className="ml-2 h-4 w-4" />
                  تخطي الآن
                </Button>
                <Button className="flex-1" onClick={handleTrainingSave} disabled={saving}>
                  {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ ومتابعة
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">اربط قنواتك</h2>
                <p className="text-sm text-muted-foreground">اختر القنوات التي تريد تشغيل البوت عليها</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { name: 'واتساب', color: 'bg-green-500/10 text-green-600' },
                { name: 'إنستجرام', color: 'bg-pink-500/10 text-pink-600' },
                { name: 'مسنجر', color: 'bg-blue-500/10 text-blue-600' },
                { name: 'تيليجرام', color: 'bg-sky-500/10 text-sky-600' },
              ].map((ch) => (
                <div key={ch.name} className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${ch.color}`}>
                    <MessageSquare className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">{ch.name}</span>
                </div>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو شارك رابطاً عاماً
              <span className="h-px flex-1 bg-border" />
            </div>

            {publicUrl && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="mb-2 text-xs text-muted-foreground">رابط الدردشة العام</p>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 truncate rounded bg-background px-3 py-2 text-xs">{publicUrl}</code>
                  <Button size="sm" variant="outline" onClick={copyLink}>نسخ</Button>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => goNext()} disabled={saving}>
                <SkipForward className="ml-2 h-4 w-4" />
                تخطي الآن
              </Button>
              <Button className="flex-1" onClick={() => navigate('/dashboard/channels')}>
                ربط القنوات
              </Button>
            </div>
            <div className="mt-3 text-center">
              <button onClick={() => goNext()} className="text-sm text-primary hover:underline">
                لقد ربطتها، متابعة →
              </button>
            </div>
          </Card>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">كيف تريد أن يتصرف مساعدك؟</h2>
                <p className="text-sm text-muted-foreground">اختر قالباً جاهزاً أو اكتب تعليماتك الخاصة</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setInstructions(p.prompt)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="أنت مساعد دعم العملاء لهذا النشاط. أجب عن أسئلة المستخدمين باستخدام البيانات المتوفرة وحافظ على نبرة احترافية."
              rows={6}
              maxLength={2000}
            />

            <Button className="mt-6 w-full h-11" onClick={handleFinish} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              <Rocket className="ml-2 h-4 w-4" />
              حفظ وتفعيل
            </Button>
          </Card>
        )}

        {/* Step 5 - Final */}
        {step === 5 && (
          <Card className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">مساعدك يعمل الآن 🎉</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              تم تفعيل البوت بنجاح. ابدأ التجربة الآن أو شارك الرابط مع عملائك.
            </p>

            <Button size="lg" className="mt-8 h-12 px-8" onClick={() => navigate('/dashboard/test')}>
              <MessageSquare className="ml-2 h-5 w-5" />
              ابدأ المحادثة
            </Button>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button variant="outline" onClick={() => navigate('/dashboard/test')}>
                <Bot className="ml-2 h-4 w-4" /> تجربة البوت
              </Button>
              <Button variant="outline" onClick={copyLink} disabled={!publicUrl}>
                <Share2 className="ml-2 h-4 w-4" /> نسخ الرابط
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard/channels')}>
                <MessageSquare className="ml-2 h-4 w-4" /> ربط القنوات
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="ml-2 h-4 w-4" /> لوحة التحكم
              </Button>
            </div>
          </Card>
        )}

        {step < 5 && (
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/dashboard')} className="text-xs text-muted-foreground hover:text-foreground">
              تخطي الإعداد والذهاب للوحة التحكم
            </button>
          </div>
        )}
      </div>
    </div>
  );
}