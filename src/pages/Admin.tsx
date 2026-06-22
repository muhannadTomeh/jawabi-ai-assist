import { Navigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { AdminStats } from '@/components/admin/AdminStats';
import { UsersList } from '@/components/admin/UsersList';
import { ChatbotsList } from '@/components/admin/ChatbotsList';
import { LlmSettings } from '@/components/admin/LlmSettings';
import { Loader2, ShieldCheck, Cpu, Users, Bot } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPage() {
  const { isAdmin, loading } = useAdminCheck();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div dir="rtl" className="space-y-8 text-right">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">لوحة تحكم الأدمن</h1>
          <p className="text-muted-foreground">
            إدارة المستخدمين والشات بوتات والإحصائيات العامة
          </p>
        </div>
      </div>

      {/* Stats */}
      <AdminStats />

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4" dir="rtl">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            المستخدمون
          </TabsTrigger>
          <TabsTrigger value="chatbots" className="gap-2">
            <Bot className="h-4 w-4" />
            الشات بوتات
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-2">
            <Cpu className="h-4 w-4" />
            نموذج الذكاء
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersList />
        </TabsContent>
        <TabsContent value="chatbots">
          <ChatbotsList />
        </TabsContent>
        <TabsContent value="llm">
          <LlmSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
