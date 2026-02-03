import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'connected' | 'disconnected' | 'pending';
  className?: string;
}

const statusConfig = {
  active: { label: 'Active', color: 'bg-success' },
  inactive: { label: 'Inactive', color: 'bg-muted-foreground' },
  connected: { label: 'Connected', color: 'bg-success' },
  disconnected: { label: 'Disconnected', color: 'bg-muted-foreground' },
  pending: { label: 'Pending', color: 'bg-warning' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'active' || status === 'connected'
          ? 'bg-success/10 text-success'
          : status === 'pending'
          ? 'bg-warning/10 text-warning'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      <Circle className={cn('h-1.5 w-1.5 fill-current', config.color)} />
      {config.label}
    </span>
  );
}
