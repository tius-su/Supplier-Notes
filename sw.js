const CACHE_NAME = 'nota-keuangan-cache-v1';
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'app.js',
    'logo.png',
    'logo1.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://www.gstatic.com/firebasejs/9.6.7/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});
