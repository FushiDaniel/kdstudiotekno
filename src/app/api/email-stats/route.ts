import { NextRequest, NextResponse } from 'next/server';
import { EmailOptimizer } from '@/lib/email-optimizer';

export async function GET(request: NextRequest) {
  try {
    const stats = {
      remainingQuota: EmailOptimizer.getRemainingQuota(),
      canSendEmail: EmailOptimizer.canSendEmail(),
      recommendations: [
        'Use push notifications for non-critical alerts',
        'Batch email notifications to reduce API calls',
        'Limit calendar notifications to 15 recipients max',
        'Only send email fallbacks for critical notifications'
      ],
      optimizations: {
        dailyEmailLimit: 50,
        batchSize: 5,
        batchDelay: '2 seconds',
        rateLimitMinutes: 5
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email statistics' },
      { status: 500 }
    );
  }
}