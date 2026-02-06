import { useState, useEffect } from 'react';
import { Plus, Search, FileText, MessageCircle, File, MoreHorizontal, Trash2, Edit, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useChatbot } from '@/hooks/useChatbot';
import { useToast } from '@/hooks/use-toast';
import { AddContentDialog } from '@/components/knowledge/AddContentDialog';
import { FileUploadDialog } from '@/components/knowledge/FileUploadDialog';

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

const typeIcons: Record<string, typeof FileText> = {
  text: FileText,
  faq: MessageCircle,
  file: File,
};

const typeLabels: Record<string, string> = {
  text: 'محتوى نصي',
  faq: 'سؤال وجواب',
  file: 'ملف',
};

export default function KnowledgeBasePage() {
  const { chatbot, loading: chatbotLoading } = useChatbot();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<KnowledgeItem | null>(null);
  const { toast } = useToast();

  const fetchItems = async () => {
    if (!chatbot) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('chatbot_id', chatbot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching knowledge items:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحميل قاعدة المعرفة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatbot) {
      fetchItems();
    }
  }, [chatbot]);

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      // If it's a file, delete from storage first
      if (deleteItem.type === 'file' && deleteItem.file_url) {
        const { error: storageError } = await supabase.storage
          .from('knowledge-files')
          .remove([deleteItem.file_url]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('knowledge_items')
        .delete()
        .eq('id', deleteItem.id);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== deleteItem.id));

      toast({
        title: 'تم الحذف',
        description: `تم حذف "${deleteItem.title}" بنجاح`,
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء الحذف',
        variant: 'destructive',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.question?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (chatbotLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">قاعدة المعرفة</h1>
          <p className="mt-1 text-muted-foreground">
            أضف محتوى ليتعلم منه الشات بوت
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="ml-2 h-4 w-4" />
            رفع ملف
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة محتوى
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="البحث في قاعدة المعرفة..."
          className="pr-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content List */}
      {filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const Icon = typeIcons[item.type] || FileText;
            return (
              <div
                key={item.id}
                className="card-elevated flex items-center gap-4 p-4 transition-all hover:shadow-md"
              >
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {typeLabels[item.type]}
                    {item.type === 'faq' && item.question && (
                      <span className="mr-1">• {item.question}</span>
                    )}
                    {item.type === 'file' && item.file_name && (
                      <span className="mr-1">• {item.file_name}</span>
                    )}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>
                      <Edit className="ml-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-foreground">
            {searchQuery ? 'لا توجد نتائج' : 'لا يوجد محتوى'}
          </h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {searchQuery
              ? 'جرب البحث بكلمات مختلفة'
              : 'أضف أسئلة شائعة أو محتوى نصي أو ملفات لتدريب الشات بوت'}
          </p>
          {!searchQuery && (
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="ml-2 h-4 w-4" />
                رفع ملف
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة محتوى
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Content Dialog */}
      {chatbot && (
        <AddContentDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          chatbotId={chatbot.id}
          onSuccess={fetchItems}
        />
      )}

      {/* File Upload Dialog */}
      {chatbot && (
        <FileUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          chatbotId={chatbot.id}
          onSuccess={fetchItems}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المحتوى</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteItem?.title}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
