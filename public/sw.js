/* Manojitos Service Worker — Push Notifications */
const CACHE_NAME = 'manojitos-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push events (from server via Web Push protocol)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Manojitos', body: event.data ? event.data.text() : 'Nueva notificación' };
  }

  const title = data.title || 'Manojitos 🩷';
  const options = {
    body: data.body || data.message || 'Tienes una nueva notificación',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'manojitos-notif',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      notifId: data.notifId || null,
    },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle background sync (for offline resilience)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
  }
});
