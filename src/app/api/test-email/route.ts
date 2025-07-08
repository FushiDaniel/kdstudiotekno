import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Test email sending directly
    const response = await fetch(`${request.nextUrl.origin}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'aimanniel2004@gmail.com', // Your email
        subject: 'FCM Test Email',
        message: 'This is a test email from KDStudio to verify email functionality is working.'
      })
    });

    const result = await response.json();

    return NextResponse.json({
      emailTest: result,
      environment: {
        EMAIL_USER: process.env.EMAIL_USER ? '✓ Set' : '✗ Missing',
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing',
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? '✓ Set' : '✗ Missing',
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '✓ Set' : '✗ Missing',
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Same as GET for testing
  return GET(request);
}