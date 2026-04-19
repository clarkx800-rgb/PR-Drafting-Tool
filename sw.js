const CACHE_NAME = 'raildraft-v1-secure';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    // Cache the jsPDF library for offline PDF generation
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' 
];

// Install Event: Cache essential assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Fetch Event: Cache First, Network Fallback strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found, otherwise hit network
                return response || fetch(event.request);
            })
            .catch(() => {
                // If both fail (offline and not cached), fallback logic can go here
                console.error("Asset not reachable offline:", event.request.url);
            })
    );
});
