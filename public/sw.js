// Enhanced Service Worker for Pest Trace with Background Sync
const CACHE_NAME = 'pesttrace-v10';
// Do not precache /manifest.json: on Vercel Preview + Deployment Protection, same-origin manifest
// fetches get 401 and cache.addAll() would reject. The manifest is loaded via <link rel="manifest">.
const urlsToCache = ['/', '/auth/signin', '/home', '/offline.html', '/_offline'];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function offlineFallbackResponse(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) return cachedResponse;
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  });
}

function cacheSuccessfulResponse(request, response) {
  if (!response || response.status !== 200 || response.type === 'error') {
    return response;
  }
  const responseToCache = response.clone();
  caches.open(CACHE_NAME).then((cache) => {
    cache.put(request, responseToCache);
  });
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isStreamableMedia = /\.(mp4|webm|ogg)$/i.test(url.pathname);
  const isMarketingAsset = url.pathname.startsWith('/marketing/');

  // Marketing assets and streaming media: network-first, no SW cache (preserves range requests / fresh deploys).
  if (isStreamableMedia || isMarketingAsset) {
    event.respondWith(
      fetch(event.request).catch(() => offlineFallbackResponse(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((response) => cacheSuccessfulResponse(event.request, response)).catch(() =>
      offlineFallbackResponse(event.request)
    )
  );
});

// Background sync for offline queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_STARTED' });
    });

    // Trigger sync via postMessage to API or direct fetch
    const response = await fetch('/api/offline/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'background-sync' }),
    });

    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETE', success: response.ok });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Push notifications (Web Push / PWA — works on Android Chrome, desktop browsers, iOS 16.4+ when installed)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Pest Trace',
    body: 'You have a new notification',
    url: '/dashboard',
    tag: 'pesttrace-notification',
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = { ...payload, ...parsed };
      }
    }
  } catch (_) {
    try {
      const text = event.data?.text();
      if (text) payload = { ...payload, body: text };
    } catch (_) {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pest-trace.png',
      badge: '/pest-trace.png',
      tag: payload.tag,
      data: { url: payload.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  const url = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
