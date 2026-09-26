import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Check, Loader } from 'reicon-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationDetailDialog, type DetailNotification } from '@/components/notifications/NotificationDetailDialog';
import { cn } from '@/lib/utils';

type Filter = 'todas' | 'sin_leer';

/** Panel → Notificaciones: todas las de la dueña; al tocar una se abre completa. */
export default function AdminNotifications() {
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('todas');
  const [selected, setSelected] = useState<DetailNotification | null>(null);
  const list = filter === 'sin_leer' ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-header">Notificaciones</h1>
            <p className="page-subtitle">{unreadCount ? `${unreadCount} sin leer` : 'Estás al día'}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" className="h-11 rounded-full" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
              <Check className="h-4 w-4" />Marcar todas como leídas
            </Button>
          )}
        </div>

        <div className="admin-tabs flex gap-2 overflow-x-auto">
          {([['todas', `Todas (${notifications.length})`], ['sin_leer', `Sin leer (${unreadCount})`]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-medium', filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">{filter === 'sin_leer' ? 'No tienes notificaciones sin leer' : 'Aún no hay notificaciones'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {list.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => { if (!n.is_read) markAsRead.mutate(n.id); setSelected(n as unknown as DetailNotification); }}
                  className={cn('flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40', !n.is_read && 'bg-primary/5')}
                >
                  <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.is_read ? 'bg-muted-foreground/30' : 'bg-primary')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', !n.is_read ? 'font-semibold text-foreground' : 'font-medium')}>{n.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-2">{n.message}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.sent_at || n.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <NotificationDetailDialog notification={selected} audience="admin" onClose={() => setSelected(null)} />
    </AppLayout>
  );
}
