const CACHE = 'mafia-desk-v150';
const APP_SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './assets/logo-mafia.webp', './assets/favicon-32.png', './assets/favicon-64.png', './assets/favicon.ico',
  './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png',
  './assets/theme-dark-mafioso.jpg', './assets/theme-light-sheriff.jpg', './assets/theme-cafe-bar.jpg',
  './assets/avatars/raccoon.webp', './assets/avatars/cat.webp', './assets/avatars/capybara.webp', './assets/avatars/pug.webp', './assets/avatars/fox.webp',
  './assets/avatars/owl.webp', './assets/avatars/hamster.webp', './assets/avatars/lion.webp', './assets/avatars/frog.webp', './assets/avatars/boar.webp',
  './assets/signals/citizen.webp', './assets/signals/mafia.webp',
  './assets/signals/don.webp', './assets/signals/sheriff.webp',
  './assets/signals/don-found-sheriff.webp', './assets/signals/don-not-sheriff.webp',
  './src/app.js?v=150', './src/auth.js', './src/cloud-profiles.js', './src/cloud-games.js?v=150', './src/game-feedback.js', './src/game-engine.js', './src/order-service.js', './src/player-links.js', './src/timer.js', './src/lineup.js', './src/guest-names.js', './src/i18n.js', './src/firebase-config.js', './src/db.js', './src/google-sync.js', './src/enjoy.js'
];
const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all([
    cache.addAll(APP_SHELL),
    cache.addAll(FIREBASE_SDK).catch(() => {})
  ])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const firebaseSdk = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/12.16.0/');
  if (event.request.method !== 'GET' || (url.origin !== self.location.origin && !firebaseSdk)) return;
  if (firebaseSdk) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
