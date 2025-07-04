'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Notification } from '@/types';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notificationService } from '@/lib/notifications';

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

  // Email-only notification system - no push notification initialization needed
  useEffect(() => {
    console.log('Notification system ready - using email notifications');
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Notification[];
      
      // Sort manually
      const sortedNotifs = notifs.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setNotifications(sortedNotifs);
    }, (error) => {
      console.error('Error fetching notifications:', error);
    });

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