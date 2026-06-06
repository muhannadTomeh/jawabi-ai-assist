import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, MessageCircle, Loader2, Globe, Share2, Facebook, Instagram } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  onSuccess: () => void;
}

export function AddContentDialog({
  open,
  onOpenChange,
  chatbotId,
  onSuccess,
}: AddContentDialogProps) {
  const [activeTab, setActiveTab] = useState('text');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Text content state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // FAQ state
  const [faqTitle, setFaqTitle] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // URL state
  const [urlTitle, setUrlTitle] = useState('');
  const [urlValue, setUrlValue] = useState('');

  // Social state
  const [socialConnections, setSocialConnections] = useState<Array<{ id: string; platform: string; page_name: string | null }>>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('social_connections')
        .select('id, platform, page_name')
        .eq('chatbot_id', chatbotId)
        .in('platform', ['facebook', 'instagram']);
      setSocialConnections(data || []);
    })();
  }, [open, chatbotId]);

  const resetForm = () => {
    setTextTitle('');
    setTextContent('');
    setFaqTitle('');
    setFaqQuestion('');
    setFaqAnswer('');
    setUrlTitle('');
    setUrlValue('');
    setSelectedConnection('');
    setAutoSync(true);
    setActiveTab('text');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmitText = async () => {
    if (!textTitle.trim() || !textContent.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('knowledge_items').insert({
        chatbot_id: chatbotId,
        type: 'text',
        title: textTitle.trim(),
        content: textContent.trim(),
      });

      if (error) throw error;

      toast({
        title: 'تمت الإضافة بنجاح',
        description: `تم إضافة "${textTitle}" إلى قاعدة المعرفة`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error adding content:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة المحتوى',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFaq = async () => {
    if (!faqTitle.trim() || !faqQuestion.trim() || !faqAnswer.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('knowledge_items').insert({
        chatbot_id: chatbotId,
        type: 'faq',
        title: faqTitle.trim(),
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
      });

      if (error) throw error;

      toast({
        title: 'تمت الإضافة بنجاح',
        description: `تم إضافة "${faqTitle}" إلى قاعدة المعرفة`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error adding FAQ:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة السؤال',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUrl = async () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: trimmed, chatbot_id: chatbotId, title: urlTitle.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'تمت الإضافة بنجاح',
        description: `تم استخراج المحتوى من "${data?.title || trimmed}"`,
      });
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error fetching URL:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'تعذر استخراج المحتوى من الرابط',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSocial = async () => {
    if (!selectedConnection) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-social-content', {
        body: { connection_id: selectedConnection, auto_sync: autoSync },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'تمت الإضافة بنجاح',
        description: `تم جلب ${data?.inserted || 0} عنصر من الصفحة`,
      });
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Social fetch error:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'تعذر جلب محتوى الصفحة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة محتوى جديد</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              نصي
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              س/ج
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Globe className="h-4 w-4" />
              رابط
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Share2 className="h-4 w-4" />
              سوشيال
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="text-title">العنوان</Label>
              <Input
                id="text-title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="مثال: سياسة الإرجاع"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">المحتوى</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="أدخل المحتوى الذي سيتعلم منه الشات بوت..."
                rows={6}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSubmitText}
              disabled={!textTitle.trim() || !textContent.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                'إضافة المحتوى'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="faq-title">العنوان</Label>
              <Input
                id="faq-title"
                value={faqTitle}
                onChange={(e) => setFaqTitle(e.target.value)}
                placeholder="مثال: ساعات العمل"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-question">السؤال</Label>
              <Input
                id="faq-question"
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="مثال: ما هي ساعات العمل؟"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer">الإجابة</Label>
              <Textarea
                id="faq-answer"
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                placeholder="أدخل الإجابة..."
                rows={4}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSubmitFaq}
              disabled={
                !faqTitle.trim() ||
                !faqQuestion.trim() ||
                !faqAnswer.trim() ||
                loading
              }
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                'إضافة السؤال'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="url-value">رابط الموقع أو الملف</Label>
              <Input
                id="url-value"
                type="url"
                dir="ltr"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/about أو رابط Google Drive/Docs"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                يدعم صفحات الويب العامة، روابط Google Docs، وملفات Google Drive (يجب أن تكون قابلة للوصول للجميع).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-title">العنوان (اختياري)</Label>
              <Input
                id="url-title"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="مثال: صفحة من نحن"
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSubmitUrl}
              disabled={!urlValue.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري جلب المحتوى...
                </>
              ) : (
                'جلب وإضافة المحتوى'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="social" className="space-y-4 mt-4">
            {socialConnections.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Share2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  لا توجد صفحات فيسبوك أو إنستغرام مربوطة بعد.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <RouterLink to="/dashboard/channels">ربط صفحة الآن</RouterLink>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>اختر الصفحة المربوطة</Label>
                  <Select value={selectedConnection} onValueChange={setSelectedConnection} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر صفحة..." />
                    </SelectTrigger>
                    <SelectContent>
                      {socialConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            {c.platform === 'facebook' ? (
                              <Facebook className="h-4 w-4" />
                            ) : (
                              <Instagram className="h-4 w-4" />
                            )}
                            {c.page_name || c.platform}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    سيقوم البوت بجلب معلومات الصفحة وآخر 25 منشوراً والتعلم منها.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <Checkbox
                    id="auto-sync"
                    checked={autoSync}
                    onCheckedChange={(v) => setAutoSync(v === true)}
                    disabled={loading}
                  />
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm">
                    تحديث تلقائي يومياً لجلب أحدث المنشورات
                  </Label>
                </div>
                <Button
                  onClick={handleSubmitSocial}
                  disabled={!selectedConnection || loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري جلب المحتوى...
                    </>
                  ) : (
                    'جلب محتوى الصفحة'
                  )}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
