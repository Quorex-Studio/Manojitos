import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'reicon-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notificationAction, type NotificationLike } from '@/lib/notificationLinks';
import { cn } from '@/lib/utils';

export interface DetailNotification extends NotificationLike {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

interface Props {
  notification: DetailNotification | null;
  audience: 'admin' | 'customer';
  onClose: () => void;
}

const TONE: Record<string, string> = {
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  error: 'bg-destructive/10 text-destructive',
  success: 'bg-success/15 text-success',
  info: 'bg-primary/10 text-primary',
};

/** Notificación completa: título, mensaje entero, fecha y un botón a la pantalla donde se atiende. */
export function NotificationDetailDialog({ notification, audience, onClose }: Props) {
  const navigate = useNavigate();
  if (!notification) return null;
  const action = notificationAction(notification, audience);
  const when = notification.sent_at || notification.created_at;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <span className={cn('mb-2 flex h-11 w-11 items-center justify-center rounded-2xl', TONE[notification.type || 'info'] ?? TONE.info)}>
            <Bell className="h-5 w-5" />
          </span>
          <DialogTitle className="font-serif text-2xl leading-tight">{notification.title}</DialogTitle>
          {when && (
            <DialogDescription>
              {format(new Date(when), "EEEE d 'de' MMMM, h:mm a", { locale: es })}
            </DialogDescription>
          )}
        </DialogHeader>
        <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{notification.message}</p>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="rounded-full" onClick={onClose}>Cerrar</Button>
          {action && (
            <Button className="rounded-full" onClick={() => { onClose(); navigate(action.to); }}>
              {action.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
