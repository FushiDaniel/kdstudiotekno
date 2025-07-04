import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'task_new' | 'task_approved' | 'task_rejected' | 'payment_completed' | 'task_assigned' | 'system';
  relatedId?: string;
  isRead: boolean;
  createdAt: Date;
}

// Push notification service
class NotificationService {
  private static instance: NotificationService;
  private swRegistration: ServiceWorkerRegistration | null = null;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize push notifications
  async initializePushNotifications(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported in this browser');
      return false;
    }

    try {
      // Request notification permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied by user');
        return false;
      }

      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  // Check if push notifications are supported and enabled
  isPushNotificationSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  // Get current notification permission status
  getNotificationPermission(): NotificationPermission {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  // Show local notification
  async showLocalNotification(title: string, message: string, icon?: string): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: icon || '/kdlogo.jpeg',
        badge: '/kdlogo.jpeg',
        tag: 'kdstudio-notification',
        requireInteraction: false,
        silent: false
      });
    }
  }

  // Send notification to Firestore (for in-app notifications)
  async sendInAppNotification(notificationData: Omit<NotificationData, 'createdAt' | 'isRead'>): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notificationData,
        isRead: false,
        createdAt: Timestamp.fromDate(new Date())
      });
      console.log('In-app notification sent successfully');
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
    }
  }

  // Send email notification (fallback)
  async sendEmailNotification(
    userEmail: string, 
    subject: string, 
    message: string
  ): Promise<void> {
    try {
      // This would typically call your backend API to send email
      // For now, we'll use a simple API call
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userEmail,
          subject: subject,
          message: message
        })
      });

      if (response.ok) {
        console.log('Email notification sent successfully');
      } else {
        console.error('Failed to send email notification');
      }
    } catch (error) {
      console.error('Email notification error:', error);
    }
  }

  // Combined notification method - Email-only approach
  async sendNotification(
    userId: string,
    userEmail: string,
    title: string,
    message: string,
    type: NotificationData['type'],
    relatedId?: string
  ): Promise<void> {
    // Always send in-app notification
    await this.sendInAppNotification({
      userId,
      title,
      message,
      type,
      relatedId
    });

    // Send email notification (primary method)
    try {
      await this.sendEmailNotification(userEmail, title, message);
      console.log('Email notification sent successfully to:', userEmail);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Log the failure but don't throw - in-app notification was already sent
    }
  }

  // Notification templates in Malay
  getNotificationTemplate(type: NotificationData['type'], data: any) {
    switch (type) {
      case 'task_new':
        return {
          title: 'Tugasan Baru Tersedia!',
          message: `Tugasan baru "${data.taskName}" telah ditambah dan tersedia untuk diambil.`
        };
      
      case 'task_assigned':
        return {
          title: 'Tugasan Baru Ditugaskan',
          message: `Anda telah ditugaskan tugasan baru: "${data.taskName}". Tarikh akhir: ${data.deadline}`
        };
      
      case 'task_approved':
        return {
          title: 'Tugasan Diluluskan! 🎉',
          message: `Tahniah! Tugasan "${data.taskName}" telah diluluskan. Bayaran ${data.amount} akan diproses.`
        };
      
      case 'task_rejected':
        return {
          title: 'Tugasan Perlu Pembetulan',
          message: `Tugasan "${data.taskName}" perlu pembetulan. Sebab: ${data.feedback || 'Sila semak komen admin.'}`
        };
      
      case 'payment_completed':
        return {
          title: 'Bayaran Selesai! 💰',
          message: `Bayaran ${data.amount} untuk tugasan "${data.taskName}" telah selesai diproses.`
        };
      
      case 'system':
        return {
          title: data.title || 'Pemberitahuan Sistem',
          message: data.message || 'Anda mempunyai pemberitahuan baru.'
        };
      
      default:
        return {
          title: 'Pemberitahuan Baru',
          message: 'Anda mempunyai pemberitahuan baru.'
        };
    }
  }

  // Specific notification methods
  async notifyNewTask(taskName: string, allUserEmails: { userId: string; email: string }[]): Promise<void> {
    const template = this.getNotificationTemplate('task_new', { taskName });
    
    for (const user of allUserEmails) {
      await this.sendNotification(
        user.userId,
        user.email,
        template.title,
        template.message,
        'task_new'
      );
    }
  }

  async notifyTaskAssigned(
    userId: string,
    userEmail: string,
    taskName: string,
    deadline: string,
    taskId: string
  ): Promise<void> {
    const template = this.getNotificationTemplate('task_assigned', { taskName, deadline });
    
    await this.sendNotification(
      userId,
      userEmail,
      template.title,
      template.message,
      'task_assigned',
      taskId
    );
  }

  async notifyTaskApproved(
    userId: string,
    userEmail: string,
    taskName: string,
    amount: string,
    taskId: string
  ): Promise<void> {
    const template = this.getNotificationTemplate('task_approved', { taskName, amount });
    
    await this.sendNotification(
      userId,
      userEmail,
      template.title,
      template.message,
      'task_approved',
      taskId
    );
  }

  async notifyTaskRejected(
    userId: string,
    userEmail: string,
    taskName: string,
    feedback: string,
    taskId: string
  ): Promise<void> {
    const template = this.getNotificationTemplate('task_rejected', { taskName, feedback });
    
    await this.sendNotification(
      userId,
      userEmail,
      template.title,
      template.message,
      'task_rejected',
      taskId
    );
  }

  async notifyPaymentCompleted(
    userId: string,
    userEmail: string,
    taskName: string,
    amount: string,
    taskId: string
  ): Promise<void> {
    const template = this.getNotificationTemplate('payment_completed', { taskName, amount });
    
    await this.sendNotification(
      userId,
      userEmail,
      template.title,
      template.message,
      'payment_completed',
      taskId
    );
  }
}

export const notificationService = NotificationService.getInstance();