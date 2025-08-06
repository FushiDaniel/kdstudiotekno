import { getMessagingInstance } from './firebase';
import { getToken, onMessage, Messaging } from 'firebase/messaging';

export class FCMService {
  private static instance: FCMService;
  private messaging: Messaging | null = null;
  private vapidKey = 'BKlVQRrEQZpXikAgbWUTgWWgZNiEPTKnIDuMOT32pBm5MQbp0Fx0MSEw4a3pFXXirvXApEG_NNlVFyKtlCeoTwo'; // From Firebase Console Web Push certificates

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Only initialize on client side
      if (typeof window === 'undefined') {
        console.log('FCM: Server side, skipping initialization');
        return false;
      }

      // Check if FCM is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('FCM: Push messaging is not supported in this browser');
        return false;
      }

      // Get messaging instance
      this.messaging = getMessagingInstance();
      if (!this.messaging) {
        console.warn('FCM: Unable to get messaging instance');
        return false;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('FCM: Notification permission denied');
        return false;
      }

      // Register service worker
      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('FCM: Service Worker registered successfully');

      // Get FCM registration token
      const token = await this.getRegistrationToken();
      if (token) {
        console.log('FCM: Registration token obtained:', token.substring(0, 20) + '...');
        // Store token for sending push notifications (userId will be passed separately)
        await this.saveTokenToServer(token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('FCM: Initialization failed:', error);
      return false;
    }
  }

  async getRegistrationToken(): Promise<string | null> {
    try {
      if (!this.messaging) {
        console.warn('FCM: Messaging not initialized');
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: this.vapidKey
      });

      return token || null;
    } catch (error) {
      console.error('FCM: Failed to get registration token:', error);
      return null;
    }
  }

  async saveTokenToServer(token: string, userId?: string): Promise<void> {
    try {
      // Save the token to your backend/Firestore for sending push notifications
      const response = await fetch('/api/save-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, userId })
      });

      if (response.ok) {
        console.log('FCM: Token saved to server successfully for user:', userId || 'anonymous');
      } else {
        console.error('FCM: Failed to save token to server');
        const result = await response.json();
        console.error('FCM: Server response:', result);
      }
    } catch (error) {
      console.error('FCM: Error saving token to server:', error);
    }
  }

  setupForegroundMessageHandler(): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('FCM: Foreground message received:', payload);

      const notificationTitle = payload.notification?.title || 'KDStudio';
      const notificationOptions = {
        body: payload.notification?.body || 'Anda mempunyai pemberitahuan baru',
        icon: '/kdlogo.jpeg',
        badge: '/kdlogo.jpeg',
        tag: 'kdstudio-notification',
        requireInteraction: false,
        data: payload.data
      };

      // Show notification when app is in foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(notificationTitle, notificationOptions);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    });
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  getPermissionStatus(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  async sendTestNotification(title: string, body: string): Promise<void> {
    if (this.getPermissionStatus() === 'granted') {
      new Notification(title, {
        body,
        icon: '/kdlogo.jpeg',
        badge: '/kdlogo.jpeg'
      });
    }
  }

  // Call this method when user logs in to associate the token with userId
  async updateTokenWithUserId(userId: string): Promise<void> {
    try {
      const token = await this.getRegistrationToken();
      if (token) {
        console.log('FCM: Updating token with userId:', userId);
        await this.saveTokenToServer(token, userId);
      }
    } catch (error) {
      console.error('FCM: Error updating token with userId:', error);
    }
  }
}

export const fcmService = FCMService.getInstance();