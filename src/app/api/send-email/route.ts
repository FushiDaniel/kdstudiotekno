import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('📧 Email Notification (No Credentials - Development Mode):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Message:', message);
      console.log('Timestamp:', new Date().toISOString());
      console.log('---');
      
      return NextResponse.json({
        success: true,
        message: 'Email logged (no credentials configured)',
        timestamp: new Date().toISOString()
      });
    }

    // Create transporter with Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // Use App Password, not regular password
      }
    });

    // Verify transporter configuration
    await transporter.verify();

    // Create HTML email template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
            <img src="https://${request.headers.get('host')}/kdstudioEmail.png" alt="KDstudio" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
            <h1 style="color: #333; margin: 0; font-size: 24px;">KDstudio</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Sistem Pengurusan Tugasan</p>
          </div>
          
          <!-- Content -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">${subject}</h2>
            <div style="color: #666; line-height: 1.6; font-size: 16px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <!-- Footer -->
          <div style="border-top: 1px solid #f0f0f0; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Email ini dihantar secara automatik dari sistem KDstudio.<br>
              Jangan balas email ini.
            </p>
            <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
              © ${new Date().getFullYear()} KDstudio. Semua hak terpelihara.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: {
        name: 'KDstudio',
        address: process.env.EMAIL_USER
      },
      to: to,
      subject: `[KDstudio] ${subject}`,
      text: message, // Plain text fallback
      html: htmlTemplate
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      to: to,
      subject: subject,
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // Return detailed error for debugging
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}