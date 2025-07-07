'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { notificationService } from '@/lib/notifications';

export default function NotificationTest() {
  const { user } = useAuth();
  const [title, setTitle] = useState('Test Notification');
  const [message, setMessage] = useState('This is a test push notification from KDStudio');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const sendTestNotification = async () => {
    if (!user) return;

    setIsSending(true);
    setResult(null);

    try {
      // Send to current user as test
      const success = await notificationService.sendPushNotification(
        user.uid,
        title,
        message,
        'system'
      );

      if (success) {
        setResult({
          success: true,
          message: 'Push notification sent successfully! Check your browser for the notification.'
        });
      } else {
        setResult({
          success: false,
          message: 'Push notification failed. Check console for details. Email fallback may have been used.'
        });
      }
    } catch (error) {
      console.error('Test notification error:', error);
      setResult({
        success: false,
        message: 'Failed to send test notification. Check console for error details.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const sendLocalNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/kdlogo.jpeg',
        badge: '/kdlogo.jpeg',
        tag: 'kdstudio-test'
      });
      setResult({
        success: true,
        message: 'Local notification displayed successfully!'
      });
    } else if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          sendLocalNotification();
        } else {
          setResult({
            success: false,
            message: 'Notification permission denied. Please enable notifications in browser settings.'
          });
        }
      });
    } else {
      setResult({
        success: false,
        message: 'This browser does not support notifications.'
      });
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Test Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notification Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notification Message
          </label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter notification message"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={sendTestNotification}
            disabled={isSending || !title.trim() || !message.trim()}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Sending FCM...' : 'Test FCM Push'}
          </Button>

          <Button
            variant="outline"
            onClick={sendLocalNotification}
            disabled={!title.trim() || !message.trim()}
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Test Local Notification
          </Button>
        </div>

        {result && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            result.success 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <p><strong>Local Notification:</strong> Shows immediately in browser</p>
          <p><strong>FCM Push:</strong> Tests the full FCM pipeline (requires FCM_SERVER_KEY)</p>
          <p><strong>Note:</strong> Make sure notifications are enabled in your browser settings</p>
        </div>
      </CardContent>
    </Card>
  );
}