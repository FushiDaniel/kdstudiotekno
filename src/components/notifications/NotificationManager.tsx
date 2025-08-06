'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Notification } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseCache } from '@/lib/firebase-cache';
import { notificationService } from '@/lib/notifications';
import { fcmService } from '@/lib/fcm';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  createSampleNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Initialize FCM push notifications
  useEffect(() => {
    const initializeFCM = async () => {
      try {
        if (fcmService.isSupported()) {
          const initialized = await fcmService.initialize();
          if (initialized) {
            console.log('FCM initialized successfully');
            fcmService.setupForegroundMessageHandler();
            
            // If user is already logged in, associate token with user
            if (user) {
              await fcmService.updateTokenWithUserId(user.uid);
            }
          } else {
            console.log('FCM initialization failed, will use email fallback');
          }
        } else {
          console.log('FCM not supported in this browser, will use email fallback');
        }
      } catch (error) {
        console.error('FCM initialization error:', error);
      }
    };

    initializeFCM();
  }, [user]); // Add user as dependency

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    // Use cached realtime listener for notifications
    const unsubscribe = firebaseCache.setupRealtimeListener<Notification>(
      'notifications',
      (notifs) => {
        // Sort manually
        const sortedNotifs = notifs.sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        setNotifications(sortedNotifs);
        console.log(`🔔 NotificationManager: Loaded ${sortedNotifs.length} notifications from cache/firestore`);
      },
      {
        where: [['userId', '==', user.uid]]
      }
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    try {
      await Promise.all(
        unreadNotifications.map(notification =>
          updateDoc(doc(db, 'notifications', notification.id), {
            isRead: true
          })
        )
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const createSampleNotifications = async () => {
    if (!user) return;

    const sampleNotifications = [
      {
        userId: user.uid,
        title: 'Tugasan Baru Ditugaskan',
        message: 'Anda telah ditugaskan tugasan baru: "Cubaan Tugasan Web 2"',
        type: 'task' as const,
        isRead: false,
        createdAt: Timestamp.fromDate(new Date()),
      },
      {
        userId: user.uid,
        title: 'Bayaran Diproses',
        message: 'Bayaran untuk tugasan "Cubaan Tugasan Web PC" sedang diproses',
        type: 'payment' as const,
        isRead: false,
        createdAt: Timestamp.fromDate(new Date(Date.now() - 60000)),
      },
      {
        userId: user.uid,
        title: 'Sistem Dikemas Kini',
        message: 'Sistem telah dikemas kini dengan ciri-ciri baharu',
        type: 'system' as const,
        isRead: true,
        createdAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
      }
    ];

    try {
      for (const notification of sampleNotifications) {
        await addDoc(collection(db, 'notifications'), notification);
      }
      console.log('Sample notifications created');
    } catch (error) {
      console.error('Error creating sample notifications:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      createSampleNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}