// Service Worker for Best Bath Rugs
// Version 1.0.0

const CACHE_NAME = 'best-bath-rugs-v1';
const STATIC_CACHE_NAME = 'static-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/articles.json',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png'
];

// Files to cache on first access
const DYNAMIC_CACHE_PATTERNS = [
  /\.(?:png|jpg|jpeg|webp|svg|gif)$/,
  /\.(?:css|js)$/,
  /\.html$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Only cache successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Check if we should cache this response
            const shouldCache = DYNAMIC_CACHE_PATTERNS.some(pattern => 
              pattern.test(url.pathname)
            );

            if (shouldCache) {
              // Clone the response as it can only be consumed once
              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache);
                })
                .catch(err => console.warn('Failed to cache:', err));
            }

            return response;
          })
          .catch(() => {
            // Network failed, return offline fallback if available
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for analytics (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    if (event.tag === 'analytics-sync') {
      event.waitUntil(syncAnalytics());
    }
  });
}

async function syncAnalytics() {
  // Handle queued analytics events when back online
  try {
    const analyticsQueue = await getAnalyticsQueue();
    if (analyticsQueue.length > 0) {
      // Send queued events
      for (const event of analyticsQueue) {
        await sendAnalyticsEvent(event);
      }
      // Clear queue
      await clearAnalyticsQueue();
    }
  } catch (error) {
    console.warn('Analytics sync failed:', error);
  }
}

// Helper functions for analytics queue
async function getAnalyticsQueue() {
  try {
    const cache = await caches.open('analytics-queue');
    const response = await cache.match('/analytics-queue.json');
    return response ? await response.json() : [];
  } catch {
    return [];
  }
}

async function clearAnalyticsQueue() {
  try {
    const cache = await caches.open('analytics-queue');
    await cache.delete('/analytics-queue.json');
  } catch (error) {
    console.warn('Failed to clear analytics queue:', error);
  }
}

async function sendAnalyticsEvent(event) {
  // Implementation depends on your analytics provider
  return fetch('/analytics', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' }
  });
}