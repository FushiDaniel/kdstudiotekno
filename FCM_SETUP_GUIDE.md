# Firebase Cloud Messaging (FCM) Setup Guide

## Overview
Your KDStudio web application is already equipped with a comprehensive push notification system using Firebase Cloud Messaging (FCM). This guide will help you complete the setup.

## Current Status ✅
- **FCM Service**: ✅ Fully implemented (`src/lib/fcm.ts`)
- **Notification Service**: ✅ Complete with templates (`src/lib/notifications.ts`) 
- **Service Workers**: ✅ Configured (`public/firebase-messaging-sw.js`)
- **API Endpoints**: ✅ Ready (`src/app/api/send-push-notification/route.ts`)
- **React Components**: ✅ Integrated (`src/components/notifications/NotificationManager.tsx`)
- **Multi-channel Delivery**: ✅ FCM + Email fallback

## What You Need to Do

### Step 1: Get FCM Server Key from Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `kdstudio-d9676`
3. **Navigate to**: Project Settings → Cloud Messaging
4. **Find**: "Server key (legacy)" section
5. **Copy the Server Key**

### Step 2: Update Environment Variables

1. **Open**: `.env.local` file
2. **Replace**: `YOUR_FCM_SERVER_KEY_HERE` with your actual server key
3. **Save the file**

```env
FCM_SERVER_KEY=AAAA1234567890:APA91bF...your-actual-server-key-here
```

### Step 3: Generate VAPID Key (Optional - already has a default)

If you want to use your own VAPID key:

1. **Go to**: Firebase Console → Project Settings → Cloud Messaging
2. **Find**: "Web Push certificates"
3. **Generate or copy** your VAPID key
4. **Update**: `src/lib/fcm.ts` line 7 with your VAPID key

## Testing Push Notifications

### 1. Test from Browser Console

```javascript
// Test local notification
if ('Notification' in window) {
  new Notification('Test KDStudio', {
    body: 'This is a test notification',
    icon: '/kdlogo.jpeg'
  });
}
```

### 2. Test FCM Integration

The app will automatically:
- Request notification permission when user logs in
- Register service worker
- Generate FCM token
- Save token to Firestore
- Set up foreground message handling

### 3. Verify Setup

Check browser console for:
```
FCM initialized successfully
FCM: Registration token obtained: [token]
FCM: Token saved to server successfully
```

## Notification Features

### 📱 **Multi-Channel Delivery**
- **Primary**: FCM Push Notifications
- **Fallback**: Email notifications
- **In-App**: Real-time Firestore notifications

### 🌍 **Localized Content**
All notifications are in **Bahasa Malaysia**:
- Task notifications: "Tugasan Baru", "Tugasan Diluluskan"
- Payment notifications: "Bayaran Selesai"
- System notifications: "Sistem Dikemas Kini"

### 🎯 **Smart Notification Types**
- `task_new`: New task available
- `task_assigned`: Task assigned to user  
- `task_approved`: Task approved by admin
- `task_rejected`: Task needs revision
- `payment_completed`: Payment processed
- `system`: System updates

### 🔧 **Advanced Features**
- **Background notifications** when app is closed
- **Foreground notifications** when app is open
- **Click handling** to open relevant pages
- **Notification actions** (Open/Close buttons)
- **Badge notifications** with unread count
- **Auto-retry** with email fallback

## Notification Triggers

The system automatically sends notifications for:

1. **New Task Created** → All users notified
2. **Task Assigned** → Assigned user notified  
3. **Task Approved** → Task owner notified
4. **Task Rejected** → Task owner notified
5. **Payment Completed** → Task owner notified

## Browser Compatibility

### ✅ **Fully Supported**
- Chrome 50+
- Firefox 44+
- Safari 16+
- Edge 79+

### ⚠️ **Limited Support**
- Safari (iOS) - Limited background support
- Firefox on mobile - Reduced functionality

### 🔄 **Fallback Handling**
- Automatic permission requests
- Email notifications for unsupported browsers
- Graceful degradation for older browsers

## Security Features

- **Token management**: Secure token storage in Firestore
- **User-specific delivery**: Notifications only to intended users
- **Rate limiting**: Built-in FCM rate limits
- **Secure headers**: HTTPS-only delivery

## Troubleshooting

### Permission Issues
```javascript
// Check permission status
console.log('Notification permission:', Notification.permission);

// Request permission manually
Notification.requestPermission().then(permission => {
  console.log('Permission result:', permission);
});
```

### Service Worker Issues
```javascript
// Check service worker registration
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service workers:', registrations);
});
```

### FCM Token Issues
- Check browser console for FCM initialization logs
- Verify Firebase configuration in `src/lib/firebase.ts`
- Ensure VAPID key is correct in `src/lib/fcm.ts`

## Production Deployment

### Vercel/Netlify
- ✅ Environment variables automatically handled
- ✅ Service workers properly served
- ✅ HTTPS required (automatically provided)

### Custom Server
- Ensure HTTPS is enabled
- Serve service workers from root domain
- Set proper CORS headers for FCM

## Firebase Console Verification

In Firebase Console, you should see:
1. **Cloud Messaging**: Server key configured
2. **Firestore**: `fcm_tokens` collection with user tokens
3. **Firestore**: `notifications` collection with notification history
4. **Analytics**: Notification delivery statistics

---

## ⚡ Quick Start

1. **Get FCM Server Key** from Firebase Console
2. **Update** `.env.local` with your server key  
3. **Deploy** your application
4. **Test** by creating a new task (all users will be notified)

Your push notification system is now ready! 🚀

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify Firebase Console configuration
3. Test with different browsers
4. Check network connectivity

The notification system includes comprehensive error handling and will gracefully fallback to email notifications if push notifications fail.