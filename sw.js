/**
 * QUR'AN WORLD VIEW — sw.js
 * Service Worker · Cache-first for shell, network-first for data.
 */

const CACHE_VERSION = 'qwv-v1';
const CACHE_NAME    = `${CACHE_VERSION}-${new Date().toISOString().split('T')[0]}`;

// Files to cache immediately on install (the app shell)
const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/design.css',
  '/css/components.css',
  '/js/app.js',
  '/js/core/firebase.js',
  '/js/core/auth.js',
  '/js/core/i18n.js',
  '/js/core/ArabicText.js',
  '/js/core/theme.js',
  '/js/components/navbar.js',
  '/js/components/footer.js',
  '/js/data/slides.json',
  '/js/data/ayah-of-the-day.json',
  '/js/data/testimonials.json',
  '/js/data/reflection-prompts.json',
  '/manifest.json',
];

// Install — cache shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
});

// Activate — remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for shell assets, network-first for Firestore/API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin non-CDN requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('googleapis.com') &&
      !url.hostname.includes('gstatic.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return;

  // Network-first for Firebase and API calls
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (shell, fonts, assets)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
