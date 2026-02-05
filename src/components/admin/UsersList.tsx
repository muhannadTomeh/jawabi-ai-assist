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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role?: 'admin' | 'user';
  chatbots_count?: number;
}

interface UsersListProps {
  onViewUser?: (userId: string) => void;
}

export function UsersList({ onViewUser }: UsersListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Fetch profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Fetch user roles
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) throw rolesError;

        // Fetch chatbots count per user
        const { data: chatbots, error: chatbotsError } = await supabase
          .from('chatbots')
          .select('user_id');

        if (chatbotsError) throw chatbotsError;

        // Map roles to users
        const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
        
        // Count chatbots per user
        const chatbotsCount = new Map<string, number>();
        chatbots?.forEach(c => {
          chatbotsCount.set(c.user_id, (chatbotsCount.get(c.user_id) || 0) + 1);
        });

        const enrichedUsers = (profiles || []).map(profile => ({
          ...profile,
          role: rolesMap.get(profile.user_id) as 'admin' | 'user' | undefined,
          chatbots_count: chatbotsCount.get(profile.user_id) || 0,
        }));

        setUsers(enrichedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return 'م';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>المستخدمون</CardTitle>
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
          <User className="h-5 w-5" />
          المستخدمون ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            لا يوجد مستخدمون بعد
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">الصلاحية</TableHead>
                <TableHead className="text-right">الشات بوتات</TableHead>
                <TableHead className="text-right">تاريخ التسجيل</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.full_name || 'مستخدم'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role === 'admin' ? (
                      <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                        <Shield className="h-3 w-3 ml-1" />
                        أدمن
                      </Badge>
                    ) : (
                      <Badge variant="secondary">مستخدم</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.chatbots_count}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'dd MMM yyyy', { locale: ar })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewUser?.(user.user_id)}
                    >
                      <Eye className="h-4 w-4 ml-1" />
                      عرض
                    </Button>
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
