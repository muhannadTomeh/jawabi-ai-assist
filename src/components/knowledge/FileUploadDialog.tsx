import { useState, useRef } from 'react';
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
import { Upload, File, X, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  onSuccess: () => void;
}

const DOC_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_TYPES = [...DOC_TYPES, ...IMAGE_TYPES];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploadDialog({
  open,
  onOpenChange,
  chatbotId,
  onSuccess,
}: FileUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setUploading(false);
    setAnalyzing(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'نوع الملف غير مدعوم. الأنواع المدعومة: PDF, TXT, DOC, DOCX, JPG, PNG, WEBP, GIF';
    }
    if (file.size > MAX_SIZE) {
      return 'حجم الملف يتجاوز الحد الأقصى (10 ميجابايت)';
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      toast({
        title: 'خطأ في الملف',
        description: error,
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file || !title.trim() || !chatbotId) return;

    setUploading(true);

    try {
      const isImage = IMAGE_TYPES.includes(file.type);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${chatbotId}/${fileName}`;
      const bucket = isImage ? 'knowledge-images' : 'knowledge-files';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      let storedUrl = filePath;
      let analyzedDescription = '';

      if (isImage) {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        storedUrl = urlData.publicUrl;

        setAnalyzing(true);
        try {
          const { data: analyzeData } = await supabase.functions.invoke('analyze-image', {
            body: { image_url: storedUrl, title: title.trim() },
          });
          analyzedDescription = analyzeData?.description || '';
        } catch (e) {
          console.error('analyze-image failed:', e);
        } finally {
          setAnalyzing(false);
        }
      }

      const combinedContent = isImage
        ? [description.trim(), analyzedDescription].filter(Boolean).join('\n\n---\nتحليل تلقائي للصورة:\n')
        : null;

      const { error: dbError } = await supabase.from('knowledge_items').insert({
        chatbot_id: chatbotId,
        type: isImage ? 'image' : 'file',
        title: title.trim(),
        file_name: file.name,
        file_url: storedUrl,
        content: combinedContent,
      });
      if (dbError) throw dbError;

      toast({
        title: isImage ? 'تم رفع الصورة وتحليلها' : 'تم رفع الملف بنجاح',
        description: `تم إضافة "${title}" إلى قاعدة المعرفة`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'خطأ في الرفع',
        description: 'حدث خطأ أثناء رفع الملف. حاول مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return null;
    if (IMAGE_TYPES.includes(file.type)) {
      return <ImageIcon className="h-8 w-8 text-primary" />;
    }
    return <File className="h-8 w-8 text-primary" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>رفع ملف</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors
                ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                اسحب الملف هنا أو اضغط للاختيار
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, TXT, DOC, DOCX, JPG, PNG, WEBP, GIF - حتى 10 ميجابايت
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFileSelect(selected);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                {getFileIcon()}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {IMAGE_TYPES.includes(file.type) && (
                <img
                  src={URL.createObjectURL(file)}
                  alt="معاينة"
                  className="max-h-48 w-full rounded-lg object-contain border bg-muted/30"
                />
              )}
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">العنوان</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: قائمة الأسعار، كتالوج المنتج..."
              disabled={uploading}
            />
          </div>

          {file && IMAGE_TYPES.includes(file.type) && (
            <div className="space-y-2">
              <Label htmlFor="description">وصف الصورة (اختياري)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="متى ترسل هذه الصورة للزبون؟ ماذا تحتوي؟ سيتم تحليلها تلقائياً أيضاً."
                rows={3}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                سيقوم الذكاء الاصطناعي بقراءة الصورة واستخراج محتواها تلقائياً، وسيرسلها للزبون عند الحاجة.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!file || !title.trim() || uploading}
              className="flex-1"
            >
              {analyzing ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري تحليل الصورة...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <CheckCircle className="ml-2 h-4 w-4" />
                  رفع
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
