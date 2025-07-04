import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Save FCM token to Firestore
    // You can associate it with a user ID if available
    const tokenData = {
      token,
      userId: userId || 'anonymous',
      createdAt: new Date(),
      lastUpdated: new Date(),
      active: true
    };

    // Save to fcm_tokens collection
    await setDoc(doc(collection(db, 'fcm_tokens'), token), tokenData);

    console.log('FCM token saved successfully:', {
      token: token.substring(0, 20) + '...', // Log partial token for security
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'FCM token saved successfully'
    });

  } catch (error) {
    console.error('Error saving FCM token:', error);
    return NextResponse.json(
      { error: 'Failed to save FCM token' },
      { status: 500 }
    );
  }
}