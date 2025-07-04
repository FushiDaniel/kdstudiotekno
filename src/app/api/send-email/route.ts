import { NextRequest, NextResponse } from 'next/server';

// Simple email notification endpoint
// In a production app, you'd use a service like Nodemailer, SendGrid, AWS SES, etc.
export async function POST(request: NextRequest) {
  try {
    const { to, subject, message } = await request.json();

    // Validate input
    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      );
    }

    // For development/demo purposes, we'll just log the email
    // In production, replace this with actual email sending logic
    console.log('📧 Email Notification (Development Mode):');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Message:', message);
    console.log('Timestamp:', new Date().toISOString());
    console.log('---');

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Email notification logged successfully (development mode)',
      timestamp: new Date().toISOString()
    });

    /* 
    PRODUCTION IMPLEMENTATION EXAMPLE:
    
    // Using Nodemailer with Gmail
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
               <h2 style="color: #333;">${subject}</h2>
               <p style="color: #666; line-height: 1.6;">${message}</p>
               <br>
               <p style="color: #999; font-size: 12px;">
                 Email ini dihantar secara automatik dari sistem KDStudio.
               </p>
             </div>`
    };

    await transporter.sendMail(mailOptions);
    */

  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send email notification' },
      { status: 500 }
    );
  }
}