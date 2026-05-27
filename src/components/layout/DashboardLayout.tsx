import { Navigate, Outlet } from 'react-router-dom';
import { AppSidebar, MobileSidebar } from './AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:pr-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
          <span className="text-lg font-semibold">جوابي</span>
          <MobileSidebar />
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
