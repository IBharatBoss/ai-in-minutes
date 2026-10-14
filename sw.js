// Service Worker for Progressive Web App (PWA) Offline Cache & Installation
// VERSION 2: Auto-cache purging & Network-First HTML Strategy
const CACHE_NAME = 'ai-agent-pwa-v2';
const ASSETS_TO_CACHE = [
    './',
    './app.html',
    './index.html',
    './manifest.webmanifest',
    './me.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.warn('Pre-cache partial warning:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('Purging legacy cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // 1. Pass Google Gemini API calls directly to network without caching
    if (event.request.method !== 'GET' || event.request.url.includes('generativelanguage.googleapis.com')) {
        return;
    }

    // 2. Network-first for HTML pages so users ALWAYS get the latest version when online
    const isHtml = event.request.mode === 'navigate' || 
                   (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
                   event.request.url.endsWith('.html') ||
                   event.request.url.endsWith('/');

    if (isHtml) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache ONLY if completely offline
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 3. Stale-while-revalidate for static assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => cachedResponse);
            return cachedResponse || fetchPromise;
        })
    );
});
