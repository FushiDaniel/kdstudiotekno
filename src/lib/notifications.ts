import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'task_new' | 'task_approved' | 'task_rejected' | 'payment_completed' | 'task_assigned' | 'task_needs_review' | 'system';
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
      // Clean the data to remove undefined values that Firestore doesn't accept
      const cleanData = {
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        isRead: false,
        createdAt: Timestamp.fromDate(new Date())
      };

      // Only add relatedId if it's defined and not null
      if (notificationData.relatedId !== undefined && notificationData.relatedId !== null) {
        (cleanData as any).relatedId = notificationData.relatedId;
      }

      await addDoc(collection(db, 'notifications'), cleanData);
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

  // Combined notification method - FCM Push + Email fallback
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

    // Try to send push notification first (costs less than email)
    try {
      const pushSuccess = await this.sendPushNotification(userId, title, message, type, relatedId);
      if (pushSuccess) {
        console.log('Push notification sent successfully to user:', userId);
        return; // Success, no need for email fallback
      }
    } catch (error) {
      console.warn('Push notification failed, falling back to email:', error);
    }

    // Fallback to email notification for all types
    try {
      await this.sendEmailNotification(userEmail, title, message);
      console.log('Email notification sent successfully to:', userEmail);
    } catch (error) {
      console.error('Both push and email notifications failed:', error);
      // At least in-app notification was sent
    }
  }

  // Send push notification via FCM
  async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationData['type'],
    relatedId?: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: message,
          userId,
          data: {
            type,
            taskId: relatedId,
            url: '/' // You can customize this based on notification type
          }
        })
      });

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
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
      
      case 'task_needs_review':
        return {
          title: 'Tugasan Perlu Disemak',
          message: `Tugasan "${data.taskName}" telah dihantar oleh ${data.assignedUser} dan menunggu semakan admin.`
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

  async notifyTaskNeedsReview(
    taskName: string,
    assignedUser: string,
    taskId: string,
    adminEmails: { userId: string; email: string }[]
  ): Promise<void> {
    const template = this.getNotificationTemplate('task_needs_review', { taskName, assignedUser });
    
    for (const admin of adminEmails) {
      await this.sendNotification(
        admin.userId,
        admin.email,
        template.title,
        template.message,
        'task_needs_review',
        taskId
      );
    }
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

  async notifyAccountApproved(
    userEmail: string,
    userName: string
  ): Promise<void> {
    const title = 'Akaun Diluluskan! 🎉';
    const message = `Tahniah ${userName}! Akaun anda telah diluluskan dan kini boleh menggunakan sistem KDstudio. Anda kini boleh log masuk dan mula mengambil tugasan.`;
    
    await this.sendEmailNotification(
      userEmail,
      title,
      message
    );
  }

  async notifyAccountRejected(
    userEmail: string,
    userName: string
  ): Promise<void> {
    const title = 'Permohonan Akaun Ditolak';
    const message = `Maaf ${userName}, permohonan akaun anda tidak dapat diluluskan pada masa ini. Jika anda mempunyai sebarang pertanyaan, sila hubungi pentadbir sistem.`;
    
    await this.sendEmailNotification(
      userEmail,
      title,
      message
    );
  }
}

export const notificationService = NotificationService.getInstance();