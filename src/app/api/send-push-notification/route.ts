import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Dynamic imports for Firebase Admin to prevent build-time initialization
let admin: any = null;

// Initialize Firebase Admin SDK dynamically
async function initializeFirebaseAdmin() {
  if (!admin) {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    
    if (!getApps().length) {
      if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase Admin credentials not configured');
      }
      
      initializeApp({
        credential: cert({
          projectId: 'kdstudio-d9676',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        projectId: 'kdstudio-d9676'
      });
    }
    
    const { getMessaging } = await import('firebase-admin/messaging');
    admin = { getMessaging };
  }
  
  return admin;
}

export async function POST(request: NextRequest) {
  try {
    const { title, body, userId, data } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Check if Firebase Admin is configured
    if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log('Firebase Admin credentials not configured, skipping push notification');
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin credentials not configured'
      });
    }

    // Initialize Firebase Admin SDK
    let firebaseAdmin;
    try {
      firebaseAdmin = await initializeFirebaseAdmin();
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin initialization failed'
      });
    }

    // Get FCM tokens from Firestore
    let tokensQuery;
    if (userId) {
      // Send to specific user
      tokensQuery = query(
        collection(db, 'fcm_tokens'), 
        where('userId', '==', userId),
        where('active', '==', true)
      );
    } else {
      // Send to all users
      tokensQuery = query(
        collection(db, 'fcm_tokens'),
        where('active', '==', true)
      );
    }

    const tokensSnapshot = await getDocs(tokensQuery);
    const tokens = tokensSnapshot.docs
      .map(doc => doc.data().token)
      .filter(token => token && token.length > 0); // Filter out empty tokens

    console.log(`Found ${tokens.length} FCM tokens for userId: ${userId || 'all users'}`);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for notification - this explains the fallback to email');
      return NextResponse.json({
        success: false,
        message: `No FCM tokens found for ${userId ? 'user ' + userId : 'any users'}. Email fallback will be used.`,
        debug: {
          totalDocs: tokensSnapshot.docs.length,
          userId: userId,
          hasTokens: tokensSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            userId: doc.data().userId, 
            hasToken: !!doc.data().token,
            active: doc.data().active
          }))
        }
      });
    }

    // Use Firebase Admin SDK to send messages
    const messaging = firebaseAdmin.getMessaging();
    const sendPromises = tokens.map(token => {
      const message = {
        token: token,
        notification: {
          title: title,
          body: body,
          imageUrl: '/kdlogo.jpeg'
        },
        data: {
          url: data?.url || '/',
          taskId: data?.taskId || '',
          type: data?.type || 'general',
          ...data
        },
        webpush: {
          notification: {
            icon: '/kdlogo.jpeg',
            badge: '/kdlogo.jpeg',
            vibrate: [100, 50, 100],
            requireInteraction: false,
            actions: [
              {
                action: 'open',
                title: 'Buka Aplikasi'
              },
              {
                action: 'close', 
                title: 'Tutup'
              }
            ]
          }
        }
      };
      
      return messaging.send(message);
    });

    // Send all notifications and handle results
    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;

    console.log('Push notifications sent:', {
      success: successCount,
      failure: failureCount,
      title: title,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: successCount > 0,
      message: `Push notifications sent: ${successCount} succeeded, ${failureCount} failed`,
      results: {
        success: successCount,
        failure: failureCount,
        total: tokens.length
      }
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}