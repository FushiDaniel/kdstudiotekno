import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmploymentType } from '@/types';
import { EmailOptimizer } from '@/lib/email-optimizer';

// Rate limiting cache to prevent spam
const emailCache = new Map<string, number>();
const RATE_LIMIT_MINUTES = 5; // Prevent same event notifications within 5 minutes

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to get event type label in Malay
function getEventTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'meeting': 'Mesyuarat',
    'training': 'Latihan',
    'workshop': 'Bengkel',
    'review': 'Semakan',
    'presentation': 'Pembentangan',
    'client_meeting': 'Mesyuarat Pelanggan',
    'team_building': 'Team Building',
    'announcement': 'Pengumuman',
    'other': 'Lain-lain'
  };
  return typeLabels[type] || type;
}

// Function to format date in Malay
function formatDateMalay(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur'
  };
  
  return date.toLocaleDateString('ms-MY', options);
}

export async function POST(request: NextRequest) {
  try {
    const {
      eventId,
      eventTitle,
      eventDescription,
      eventStart,
      eventEnd,
      eventType,
      location,
      notificationSettings,
      participantGroups,
      createdByName
    } = await request.json();

    console.log('Calendar notification request:', {
      eventTitle,
      notificationSettings,
      participantGroups
    });

    // Rate limiting check - prevent duplicate notifications
    const cacheKey = `${eventId || eventTitle}_${eventStart}_${eventEnd}`;
    const now = Date.now();
    const lastSent = emailCache.get(cacheKey);
    
    if (lastSent && (now - lastSent) < (RATE_LIMIT_MINUTES * 60 * 1000)) {
      console.log(`Rate limited: Calendar notification for "${eventTitle}" was already sent recently`);
      return NextResponse.json({ 
        success: true, 
        message: 'Notification already sent recently (rate limited)',
        emailsSent: 0
      });
    }

    // Get users to notify based on participant groups and notification settings
    const usersToNotify: string[] = [];
    
    if (participantGroups?.freelance && notificationSettings?.notifyFreelance) {
      const freelanceQuery = query(
        collection(db, 'users'),
        where('employmentType', '==', EmploymentType.FREELANCE),
        where('isApproved', '==', true)
      );
      const freelanceSnapshot = await getDocs(freelanceQuery);
      freelanceSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          usersToNotify.push(userData.email);
        }
      });
    }

    if (participantGroups?.partTime && notificationSettings?.notifyPartTime) {
      const partTimeQuery = query(
        collection(db, 'users'),
        where('employmentType', '==', EmploymentType.PART_TIME),
        where('isApproved', '==', true)
      );
      const partTimeSnapshot = await getDocs(partTimeQuery);
      partTimeSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          usersToNotify.push(userData.email);
        }
      });
    }

    if (participantGroups?.fullTime && notificationSettings?.notifyFullTime) {
      const fullTimeQuery = query(
        collection(db, 'users'),
        where('employmentType', '==', EmploymentType.FULL_TIME),
        where('isApproved', '==', true)
      );
      const fullTimeSnapshot = await getDocs(fullTimeQuery);
      fullTimeSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          usersToNotify.push(userData.email);
        }
      });
    }

    // Remove duplicates and optimize list to control costs
    const uniqueEmails = EmailOptimizer.optimizeEmailList(usersToNotify, 15);

    console.log(`Found ${uniqueEmails.length} users to notify:`, uniqueEmails);

    // Check if we can send emails (quota control)
    if (!EmailOptimizer.canSendEmail()) {
      console.log('Daily email quota exceeded, skipping calendar notifications');
      return NextResponse.json({ 
        success: false, 
        message: 'Daily email quota exceeded. Notifications paused to control costs.',
        emailsSent: 0,
        quotaExceeded: true
      });
    }

    if (uniqueEmails.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No users to notify',
        emailsSent: 0
      });
    }

    // Prepare email content
    const eventTypeLabel = getEventTypeLabel(eventType);
    const startDate = formatDateMalay(eventStart);
    const endDate = formatDateMalay(eventEnd);

    const emailSubject = `📅 Acara Kalendar Baru: ${eventTitle}`;
    
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; }
        .event-details { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d; }
        .highlight { color: #0066cc; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📅 Acara Kalendar Baru</h2>
            <p>Anda telah dijemput untuk menghadiri acara berikut:</p>
        </div>
        
        <div class="content">
            <h3 class="highlight">${eventTitle}</h3>
            
            <div class="event-details">
                <p><strong>📝 Jenis Acara:</strong> ${eventTypeLabel}</p>
                <p><strong>🕐 Tarikh & Masa Mula:</strong> ${startDate}</p>
                <p><strong>🕐 Tarikh & Masa Tamat:</strong> ${endDate}</p>
                ${location ? `<p><strong>📍 Lokasi:</strong> ${location}</p>` : ''}
                ${eventDescription ? `<p><strong>📋 Keterangan:</strong><br>${eventDescription}</p>` : ''}
                <p><strong>👤 Dicipta oleh:</strong> ${createdByName}</p>
            </div>
            
            <p>Sila catat tarikh dan masa ini dalam kalendar anda. Jika anda mempunyai sebarang pertanyaan, sila hubungi admin.</p>
        </div>
        
        <div class="footer">
            <p>Email ini dihantar secara automatik oleh sistem KDStudio.</p>
            <p>Jangan balas email ini.</p>
        </div>
    </div>
</body>
</html>
    `;

    // Send emails in smaller batches to reduce costs and avoid rate limits
    let emailsSent = 0;
    const BATCH_SIZE = 5; // Send max 5 emails at once to reduce costs
    const BATCH_DELAY = EmailOptimizer.getBatchDelay(); // Use optimized delay
    
    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (email) => {
        try {
          await transporter.sendMail({
            from: `KDStudio <${process.env.EMAIL_USER}>`,
            to: email,
            subject: emailSubject,
            html: emailBody,
          });
          emailsSent++;
          EmailOptimizer.incrementEmailCount(); // Track for quota
          console.log(`Calendar notification sent to: ${email}`);
        } catch (error) {
          console.error(`Failed to send email to ${email}:`, error);
        }
      });

      await Promise.all(batchPromises);
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < uniqueEmails.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Update cache after successful send
    emailCache.set(cacheKey, now);
    
    console.log(`Successfully sent ${emailsSent}/${uniqueEmails.length} calendar notifications`);

    return NextResponse.json({
      success: true,
      message: `Calendar notifications sent successfully`,
      emailsSent,
      totalRecipients: uniqueEmails.length
    });

  } catch (error) {
    console.error('Error sending calendar notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications', details: error },
      { status: 500 }
    );
  }
}