/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { registerRoute } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// -----------------------------------------------
// Workbox Precaching & Routing
// -----------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Google Fonts cachen
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Supabase API: NetworkFirst (immer aktuelle Daten)
registerRoute(
  ({ url }) => url.origin.includes('supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-api-cache' })
);

// -----------------------------------------------
// 🔔 Web Push Event Handler
// -----------------------------------------------
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }

  let payload: PushNotificationPayload;

  try {
    payload = event.data.json() as PushNotificationPayload;
  } catch {
    payload = {
      title: 'Rebelein LagerApp',
      body: event.data.text(),
    };
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag || 'lager-push',
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    renotify: !!payload.tag,
    requireInteraction: false,
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// -----------------------------------------------
// 🔔 Notification Click Handler
// -----------------------------------------------
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const notifData = event.notification.data as { url?: string } | null;
  const url = notifData?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            (client as WindowClient).focus();
            return (client as WindowClient).navigate(url);
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// -----------------------------------------------
// Push Subscription Change (z.B. bei Browser-Update)
// -----------------------------------------------
self.addEventListener('pushsubscriptionchange', () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_SUBSCRIPTION_CHANGED',
        message: 'Bitte Push-Benachrichtigungen neu aktivieren',
      });
    });
  });
  console.warn('[SW] Push-Subscription geändert - bitte neu registrieren');
});
