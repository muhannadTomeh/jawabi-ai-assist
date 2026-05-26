import { useLocation, Link } from 'react-router-dom';
import {
  Bot,
  BookOpen,
  Share2,
  BarChart3,
  Settings,
  MessageSquare,
  LogOut,
  User,
  ShieldCheck,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useNotifications } from '@/hooks/useNotifications';

const navigation = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Bot },
  { name: 'قاعدة المعرفة', href: '/dashboard/knowledge', icon: BookOpen },
  { name: 'القنوات', href: '/dashboard/channels', icon: Share2 },
  { name: 'الإحصائيات', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'تجربة الشات', href: '/dashboard/test', icon: MessageSquare },
  { name: 'الإشعارات', href: '/dashboard/notifications', icon: Bell },
  { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { unreadCount } = useNotifications();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-64 border-l border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-foreground">
              جوابي
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'nav-item',
                  active ? 'nav-item-active' : 'nav-item-inactive'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.name}</span>
                {item.href === '/dashboard/notifications' && unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
          
          {/* Admin Link */}
          {isAdmin && (
            <Link
              to="/dashboard/admin"
              className={cn(
                'nav-item mt-4 border-t border-sidebar-border pt-4',
                isActive('/dashboard/admin') ? 'nav-item-active' : 'nav-item-inactive'
              )}
            >
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <span>لوحة الأدمن</span>
            </Link>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.user_metadata?.full_name || 'مستخدم'}
              </p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
