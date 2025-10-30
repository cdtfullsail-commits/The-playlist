// A service worker to enable offline functionality (PWA)

const CACHE_NAME = 'producer-playlist-hub-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx', 
  '/App.tsx',
  '/components/FileUpload.tsx',
  '/components/Icons.tsx',
  '/components/ShareModal.tsx',
  '/types.ts',
  '/manifest.json'
];

self.addEventListener('install', (event: any) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error("Failed to cache", err);
      })
  );
});

self.addEventListener('fetch', (event: any) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For navigation requests, use a network-first strategy.
  // This ensures users get the latest version of the page if they are online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If network fails, serve the cached index.html.
        // The page's JavaScript will handle loading the correct view from the URL hash.
        return caches.match('/index.html');
      })
    );
    return;
  }
  
  // For all other requests (JS, CSS, images, etc.), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If the resource is in the cache, return it.
      if (response) {
        return response;
      }

      // If it's not in the cache, fetch it from the network.
      return fetch(event.request).then((response) => {
        // Check if we received a valid response.
        // Don't cache opaque responses from CDNs as we can't verify their status.
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Clone the response and add it to the cache for next time.
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});


self.addEventListener('activate', (event: any) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
