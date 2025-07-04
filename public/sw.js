const CACHE_NAME = 'kdstudio-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event
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
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Anda mempunyai pemberitahuan baru',
    icon: '/kdlogo.jpeg',
    badge: '/kdlogo.jpeg',
    vibrate: [100, 50, 100],
    tag: 'kdstudio-notification',
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
      taskId: data.taskId || null
    },
    actions: [
      {
        action: 'open',
        title: 'Buka Aplikasi',
        icon: '/kdlogo.jpeg'
      },
      {
        action: 'close',
        title: 'Tutup',
        icon: '/kdlogo.jpeg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'KDStudio', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') {
    return; // Just close the notification
  }
  
  // For 'open' action or clicking the notification body
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});