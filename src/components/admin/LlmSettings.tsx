import { useEffect, useState } from 'react';
import { Loader2, Save, Cpu, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 nano' },
];

export function LlmSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [model, setModel] = useState(MODELS[2].value);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('llm_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setModel(data.model);
        setApiKey(data.custom_api_key || '');
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      model,
      custom_api_key: apiKey.trim() ? apiKey.trim() : null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (id) {
      ({ error } = await supabase.from('llm_settings').update(payload).eq('id', id));
    } else {
      const res = await supabase.from('llm_settings').insert(payload).select().single();
      error = res.error;
      if (res.data) setId(res.data.id);
    }
    setSaving(false);
    if (error) toast.error('فشل حفظ الإعدادات', { description: error.message });
    else toast.success('تم حفظ إعدادات الذكاء الاصطناعي');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="card-elevated space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">إعدادات نموذج الذكاء الاصطناعي</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        تتحكم هذه الإعدادات في النموذج المستخدم لجميع الردود على مستوى المنصة.
      </p>

      <div className="space-y-2">
        <Label>النموذج (LLM)</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          المزوّد الافتراضي عبر Lovable AI Gateway. غيّر النموذج حسب الحاجة بين السرعة والجودة.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          مفتاح API مخصص (اختياري)
        </Label>
        <Input
          dir="ltr"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="اتركه فارغاً لاستخدام مفتاح Lovable AI الافتراضي"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          إذا تم تعبئته، سيتم استخدام هذا المفتاح بدلاً من المفتاح الافتراضي عند استدعاء النموذج.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}