/**
 * usePushNotifications — Hook to register and manage browser Web Push notifications.
 * Registers the service worker, requests permission, subscribes to PushManager,
 * and saves the VAPID keys to the database.
 */
import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to convert VAPID public key
function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Register service worker on mount
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

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
      setTimeout(registerSW, 2000);
    }
  }, []);

  const subscribeToPush = useCallback(async (registration: ServiceWorkerRegistration) => {
    if (!user) return;
    try {
      // Get the VAPID public key from environment variables
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.warn('Missing VITE_VAPID_PUBLIC_KEY in .env.local');
        return;
      }

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Subscribe to push
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicVapidKey)
        });
      }

      const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh') as ArrayBuffer)));
      const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth') as ArrayBuffer)));

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
      }, { onConflict: 'user_id, endpoint' });

      if (error) {
        console.error('Failed to save push subscription:', error);
      } else {
        console.log('Push subscription saved successfully');
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
    }
  }, [user]);

  // Request notification permission from the user
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones push');
      return false;
    }

    if (permission === 'granted' && swRegistration) {
      await subscribeToPush(swRegistration);
      return true;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      toast.success('¡Notificaciones activadas! Te avisaremos de tus pedidos y novedades.');
      if (swRegistration) {
        await subscribeToPush(swRegistration);
      }
      return true;
    } else {
      toast.error('Notificaciones bloqueadas. Puedes activarlas desde la configuración de tu navegador.');
      return false;
    }
  }, [isSupported, permission, swRegistration, subscribeToPush]);

  /**
   * Show a local browser push notification immediately.
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
      } else if (typeof window !== 'undefined' && 'Notification' in window && typeof window.Notification === 'function') {
        try {
          new window.Notification(title, notifOptions);
        } catch {
          // Fallback if Notification constructor is disabled on mobile
        }
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
