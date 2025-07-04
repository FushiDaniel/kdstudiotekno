import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { title, body, userId, data } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Get FCM server key from environment variables
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (!fcmServerKey) {
      console.log('FCM Server Key not configured, skipping push notification');
      return NextResponse.json({
        success: false,
        message: 'FCM Server Key not configured'
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
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for notification');
      return NextResponse.json({
        success: false,
        message: 'No FCM tokens found'
      });
    }

    // Prepare FCM notification payload
    const fcmPayload = {
      registration_ids: tokens,
      notification: {
        title: title,
        body: body,
        icon: '/kdlogo.jpeg',
        badge: '/kdlogo.jpeg',
        tag: 'kdstudio-notification',
        click_action: data?.url || '/'
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

    // Send push notification via FCM
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload)
    });

    const fcmResult = await fcmResponse.json();

    if (fcmResponse.ok && fcmResult.success > 0) {
      console.log('Push notification sent successfully:', {
        success: fcmResult.success,
        failure: fcmResult.failure,
        title: title,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Push notification sent successfully',
        results: {
          success: fcmResult.success,
          failure: fcmResult.failure,
          total: tokens.length
        }
      });
    } else {
      console.error('FCM send failed:', fcmResult);
      return NextResponse.json(
        { error: 'Failed to send push notification', details: fcmResult },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}