/**
 * Hermes Trading Post - Service Worker
 *
 * Advanced HTTP-level caching for chart data and assets.
 *
 * Strategies:
 * 1. Cache-First: Static assets (JS, CSS, images) - never changes
 * 2. Stale-While-Revalidate: Chart API responses - show cached, update in background
 * 3. Network-First: Real-time data (WebSocket, recent data) - need freshness
 *
 * Cache Naming:
 * - hermes-static-v1: Static assets (JS, CSS, fonts, images)
 * - hermes-chart-api-v1: Chart data API responses
 * - hermes-dynamic-v1: Other dynamic content
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `hermes-static-${CACHE_VERSION}`;
const API_CACHE = `hermes-chart-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `hermes-dynamic-${CACHE_VERSION}`;

// Assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Cache duration for different types
const CACHE_DURATION = {
  static: 30 * 24 * 60 * 60 * 1000, // 30 days
  api: 5 * 60 * 1000, // 5 minutes
  dynamic: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Service Worker Install Event
 * Pre-cache critical static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force immediate activation
      return self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activate Event
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName.startsWith('hermes-') &&
              !cacheName.includes(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

/**
 * Service Worker Fetch Event
 * Intercept network requests and apply caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Strategy selection based on URL pattern
  if (isStaticAsset(url)) {
    // Cache-First: Static assets
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isChartAPI(url)) {
    // Stale-While-Revalidate: Chart data
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
  } else if (isHistoricalData(url)) {
    // Cache-First: Historical data (doesn't change)
    event.respondWith(cacheFirst(request, API_CACHE));
  } else if (isRealtimeData(url)) {
    // Network-First: Real-time data (need freshness)
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  } else {
    // Default: Stale-While-Revalidate for other requests
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

/**
 * URL Pattern Matching Functions
 */
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  );
}

function isChartAPI(url) {
  return url.pathname.includes('/api/trading/chart-data');
}

function isHistoricalData(url) {
  // Detect historical data requests (older than 1 day)
  if (!isChartAPI(url)) return false;

  const params = url.searchParams;
  const endTime = parseInt(params.get('endTime') || '0');
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - (24 * 60 * 60);

  // If end time is more than 1 day old, it's historical (won't change)
  return endTime > 0 && endTime < oneDayAgo;
}

function isRealtimeData(url) {
  // Real-time data: recent chart data (last 5 minutes)
  if (!isChartAPI(url)) return false;

  const params = url.searchParams;
  const startTime = parseInt(params.get('startTime') || '0');
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutesAgo = now - (5 * 60);

  // If start time is within last 5 minutes, it's real-time
  return startTime > 0 && startTime > fiveMinutesAgo;
}

/**
 * Caching Strategies
 */

// Cache-First: Check cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Check if cache is expired
    const cacheTime = await getCacheTime(request, cache);
    const duration = cacheName === STATIC_CACHE ? CACHE_DURATION.static : CACHE_DURATION.api;

    if (Date.now() - cacheTime < duration) {
      console.log('[SW] Cache hit (fresh):', request.url);
      return cached;
    }
  }

  // Cache miss or expired - fetch from network
  try {
    const response = await fetch(request);

    if (response.ok) {
      // Clone response before caching
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
      console.log('[SW] Cached:', request.url);
    }

    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);

    // Return stale cache if available
    if (cached) {
      console.log('[SW] Returning stale cache:', request.url);
      return cached;
    }

    throw error;
  }
}

// Stale-While-Revalidate: Return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fetch from network in background
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
      console.log('[SW] Background update:', request.url);
    }
    return response;
  }).catch((error) => {
    console.error('[SW] Background fetch failed:', error);
  });

  // Return cached response immediately if available
  if (cached) {
    console.log('[SW] Serving from cache (updating in background):', request.url);
    return cached;
  }

  // No cache - wait for network
  return networkFetch;
}

// Network-First: Try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      console.log('[SW] Network response cached:', request.url);
    }

    return response;
  } catch (error) {
    console.error('[SW] Network failed, trying cache:', error);

    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      console.log('[SW] Fallback to cache:', request.url);
      return cached;
    }

    throw error;
  }
}

/**
 * Helper Functions
 */

// Get cache timestamp
async function getCacheTime(request, cache) {
  const response = await cache.match(request);

  if (!response) {
    return 0;
  }

  const dateHeader = response.headers.get('date');
  return dateHeader ? new Date(dateHeader).getTime() : 0;
}

/**
 * Message Handling (for cache management from main thread)
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'CLEAR_CACHE':
      clearCache(data.cacheName).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      });
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log('[SW] Cleared cache:', cacheName);
  } else {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Cleared all caches');
  }
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

console.log('[SW] Service Worker loaded');
