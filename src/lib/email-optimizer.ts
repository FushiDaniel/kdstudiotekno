// Email optimization utility to reduce costs
export class EmailOptimizer {
  private static emailQuota: { count: number; resetTime: number } = { count: 0, resetTime: 0 };
  private static readonly DAILY_EMAIL_LIMIT = 50; // Limit emails per day
  private static readonly BATCH_SIZE = 5; // Smaller batch size
  
  // Check if we can send more emails today
  static canSendEmail(): boolean {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    // Reset counter if it's a new day
    if (now > this.emailQuota.resetTime) {
      this.emailQuota.count = 0;
      this.emailQuota.resetTime = todayStart + 24 * 60 * 60 * 1000; // Next day
    }
    
    return this.emailQuota.count < this.DAILY_EMAIL_LIMIT;
  }
  
  // Increment email count
  static incrementEmailCount(): void {
    this.emailQuota.count++;
    console.log(`Email count: ${this.emailQuota.count}/${this.DAILY_EMAIL_LIMIT}`);
  }
  
  // Get remaining email quota
  static getRemainingQuota(): number {
    return Math.max(0, this.DAILY_EMAIL_LIMIT - this.emailQuota.count);
  }
  
  // Optimize email list by removing duplicates and limiting count
  static optimizeEmailList(emails: string[], maxEmails: number = 20): string[] {
    // Remove duplicates
    const uniqueEmails = [...new Set(emails)];
    
    // Limit to reduce costs
    const limitedEmails = uniqueEmails.slice(0, maxEmails);
    
    if (limitedEmails.length < uniqueEmails.length) {
      console.log(`Email list optimized: ${uniqueEmails.length} → ${limitedEmails.length} recipients`);
    }
    
    return limitedEmails;
  }
  
  // Check if email should be sent based on priority
  static shouldSendEmail(notificationType: string, userRole: string = 'user'): boolean {
    // Always send to admins
    if (userRole === 'admin') return true;
    
    // Critical notifications for users
    const criticalTypes = [
      'task_approved', 
      'task_rejected', 
      'payment_completed',
      'account_approved',
      'account_rejected'
    ];
    
    return criticalTypes.includes(notificationType);
  }
  
  // Get recommended delay between emails (in ms)
  static getBatchDelay(): number {
    return 2000; // 2 seconds between batches to avoid rate limits
  }
}