/**
 * usePushNotifications — Hook to register and manage browser Web Push notifications.
 * Registers the service worker, requests permission, and provides a method to
 * trigger local browser notifications from in-app events.
 */
import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Register service worker on mount
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    // Defer registration to avoid blocking the main thread (LCP optimization)
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          setSwRegistration(reg);
          console.log('[Push] Service worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Push] SW registration failed:', err);
        });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(registerSW);
    } else {
      setTimeout(registerSW, 2000); // Fallback delay
    }
  }, []);

  // Request notification permission from the user
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones push');
      return false;
    }

    if (permission === 'granted') return true;

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      toast.success('¡Notificaciones activadas! Te avisaremos de tus pedidos y novedades 🩷');
      return true;
    } else {
      toast.error('Notificaciones bloqueadas. Puedes activarlas desde la configuración de tu navegador.');
      return false;
    }
  }, [isSupported, permission]);

  /**
   * Show a local browser push notification immediately.
   * This works even without a server — useful for in-app events.
   */
  const showNotification = useCallback(async (
    title: string,
    body: string,
    options?: {
      url?: string;
      tag?: string;
      icon?: string;
    }
  ) => {
    if (!isSupported) return;

    // Auto-request permission if not yet decided
    let perm = permission;
    if (perm === 'default') {
      const granted = await requestPermission();
      if (!granted) return;
      perm = 'granted';
    }

    if (perm !== 'granted') return;

    const notifOptions: NotificationOptions = {
      body,
      icon: options?.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag || 'manojitos',
      data: { url: options?.url || '/' },
    };

    try {
      if (swRegistration) {
        await swRegistration.showNotification(title, notifOptions);
      } else {
        new Notification(title, notifOptions);
      }
    } catch (err) {
      console.warn('[Push] Could not show notification:', err);
    }
  }, [isSupported, permission, requestPermission, swRegistration]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
  };
}
