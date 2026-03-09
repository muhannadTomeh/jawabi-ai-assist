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
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeItem {
  id: string;
  chatbot_id: string;
  type: string;
  title: string;
  content: string | null;
  question: string | null;
  answer: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
}

interface EditContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: KnowledgeItem | null;
  onSuccess: () => void;
}

export function EditContentDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: EditContentDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(item.content || '');
      setQuestion(item.question || '');
      setAnswer(item.answer || '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !title.trim()) return;

    setLoading(true);
    try {
      const updates: Record<string, string> = { title: title.trim() };

      if (item.type === 'text') {
        if (!content.trim()) return;
        updates.content = content.trim();
      } else if (item.type === 'faq') {
        if (!question.trim() || !answer.trim()) return;
        updates.question = question.trim();
        updates.answer = answer.trim();
      }

      const { error } = await supabase
        .from('knowledge_items')
        .update(updates)
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: 'تم التعديل',
        description: `تم تعديل "${title}" بنجاح`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء التعديل',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تعديل المحتوى</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          {item.type === 'text' && (
            <div className="space-y-2">
              <Label>المحتوى</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                disabled={loading}
              />
            </div>
          )}

          {item.type === 'faq' && (
            <>
              <div className="space-y-2">
                <Label>السؤال</Label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>الإجابة</Label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={!title.trim() || loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              'حفظ التعديلات'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
