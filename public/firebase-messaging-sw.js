// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBGqOsOhjB6KskPI9me3mdbgqlrtMjkSXA",
  authDomain: "kdstudio-d9676.firebaseapp.com",
  projectId: "kdstudio-d9676",
  storageBucket: "kdstudio-d9676.firebasestorage.app",
  messagingSenderId: "1079743577825",
  appId: "1:1079743577825:web:356861d675c8edfd8a81a0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'KDStudio';
  const notificationOptions = {
    body: payload.notification?.body || 'Anda mempunyai pemberitahuan baru',
    icon: '/kdlogo.jpeg',
    badge: '/kdlogo.jpeg',
    tag: 'kdstudio-notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
    data: {
      url: payload.data?.url || '/',
      taskId: payload.data?.taskId || null,
      type: payload.data?.type || 'general'
    },
    actions: [
      {
        action: 'open',
        title: 'Buka Aplikasi',
        icon: '/kdlogo.jpeg'
      },
      {
        action: 'close',
        title: 'Tutup'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app when notification is clicked
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
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

// Handle message received while app is in foreground
messaging.onMessage((payload) => {
  console.log('Foreground message received:', payload);
  
  // You can customize foreground notification handling here
  const notificationTitle = payload.notification?.title || 'KDStudio';
  const notificationOptions = {
    body: payload.notification?.body || 'Anda mempunyai pemberitahuan baru',
    icon: '/kdlogo.jpeg',
    tag: 'kdstudio-notification'
  };

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notificationTitle, notificationOptions);
  }
});