// ============================================================
//  Diário de Bordo LION — Service Worker
//  Estratégia: Network-first com fallback para cache
// ============================================================

var CACHE_NAME = 'dblio-v20260319';
var OFFLINE_URL = '/';

// Recursos para pré-cachear
var PRE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRE_CACHE.map(function(url) {
        return new Request(url, { mode: 'no-cors' });
      }));
    }).then(function() {
      return self.skipWaiting();
    }).catch(function(err) {
      console.warn('[SW] Pre-cache error:', err);
      return self.skipWaiting();
    })
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
// Network-first: tenta rede, se falhar usa cache
self.addEventListener('fetch', function(event) {
  // Só intercepta GET
  if (event.request.method !== 'GET') return;

  // Firebase / API calls: sempre rede, sem cache
  var url = event.request.url;
  if (url.indexOf('firestore.googleapis.com') >= 0 ||
      url.indexOf('firebase') >= 0 && url.indexOf('googleapis') >= 0) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cacheia cópias válidas
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Sem rede: usa cache
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Fallback: página principal
          return caches.match(OFFLINE_URL);
        });
      })
  );
});

// ── Push Notifications (base para futuro) ────────────────────
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) {}
  var title   = data.title   || 'Diário de Bordo LION';
  var body    = data.body    || 'Você tem uma nova notificação.';
  var icon    = data.icon    || '/icon-192.png';
  var badge   = data.badge   || '/icon-192.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body:  body,
      icon:  icon,
      badge: badge,
      vibrate: [200, 100, 200],
      data:  data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
