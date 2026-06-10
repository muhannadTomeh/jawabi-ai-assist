import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bot, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Chatbot {
  id: string;
  name: string;
  user_id: string;
  is_active: boolean;
  language: string;
  tone: string;
  created_at: string;
  owner_name?: string;
}

export function ChatbotsList() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function fetchChatbots() {
    try {
      // Fetch chatbots
      const { data: chatbotsData, error: chatbotsError } = await supabase
        .from('chatbots')
        .select('*')
        .order('created_at', { ascending: false });

      if (chatbotsError) throw chatbotsError;

      // Fetch profiles to get owner names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const enrichedChatbots = (chatbotsData || []).map(chatbot => ({
        ...chatbot,
        owner_name: profilesMap.get(chatbot.user_id) || 'مستخدم',
      }));

      setChatbots(enrichedChatbots);
    } catch (error) {
      console.error('Error fetching chatbots:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchChatbots();
  }, []);

  const toggleChatbotStatus = async (chatbot: Chatbot) => {
    try {
      const { data, error } = await supabase
        .from('chatbots')
        .update({ is_active: !chatbot.is_active })
        .eq('id', chatbot.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('لم يتم تحديث أي صف. تحقق من صلاحيات الأدمن (RLS).');
      }

      setChatbots(prev =>
        prev.map(c =>
          c.id === chatbot.id ? { ...c, is_active: !c.is_active } : c
        )
      );

      toast({
        title: chatbot.is_active ? 'تم إيقاف الشات بوت' : 'تم تفعيل الشات بوت',
        description: `${chatbot.name} ${chatbot.is_active ? 'متوقف الآن' : 'نشط الآن'}`,
      });
    } catch (error: any) {
      console.error('Error toggling chatbot:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'حدث خطأ أثناء تحديث حالة الشات بوت',
        variant: 'destructive',
      });
    }
  };

  const deleteChatbot = async (chatbot: Chatbot) => {
    try {
      const { data, error } = await supabase
        .from('chatbots')
        .delete()
        .eq('id', chatbot.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('لم يتم حذف الشات بوت. تحقق من صلاحيات الأدمن (RLS).');
      }

      setChatbots(prev => prev.filter(c => c.id !== chatbot.id));

      toast({
        title: 'تم الحذف',
        description: `تم حذف الشات بوت "${chatbot.name}" بنجاح`,
      });
    } catch (error: any) {
      console.error('Error deleting chatbot:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'حدث خطأ أثناء حذف الشات بوت',
        variant: 'destructive',
      });
    }
  };

  const getToneLabel = (tone: string) => {
    const tones: Record<string, string> = {
      professional: 'احترافي',
      friendly: 'ودود',
      casual: 'عفوي',
      formal: 'رسمي',
    };
    return tones[tone] || tone;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الشات بوتات</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          الشات بوتات ({chatbots.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chatbots.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            لا يوجد شات بوتات بعد
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">المالك</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">النبرة</TableHead>
                <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chatbots.map((chatbot) => (
                <TableRow key={chatbot.id}>
                  <TableCell className="font-medium">{chatbot.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {chatbot.owner_name}
                  </TableCell>
                  <TableCell>
                    {chatbot.is_active ? (
                      <Badge className="bg-green-500/10 text-green-600">نشط</Badge>
                    ) : (
                      <Badge variant="secondary">متوقف</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getToneLabel(chatbot.tone)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(chatbot.created_at), 'dd MMM yyyy', { locale: ar })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChatbotStatus(chatbot)}
                      >
                        {chatbot.is_active ? (
                          <ToggleRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف الشات بوت</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف الشات بوت "{chatbot.name}"؟ سيتم
                              حذف جميع البيانات المرتبطة به بشكل نهائي.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteChatbot(chatbot)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
