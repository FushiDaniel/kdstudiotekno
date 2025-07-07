export enum EmploymentType {
  FULL_TIME = "FT",
  PART_TIME = "PT",
  FREELANCE = "FL"
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
  COMPLETED = 'COMPLETED'
}

export enum TaskPaymentStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  DENIED = 'DENIED'
}

export enum AvailabilityStatus {
  IDLE = "idle",
  WORKING = "working", 
  BREAK = "break",
  DALAM_TALIAN = "dalam_talian",
  TIDAK_AKTIF = "tidak_aktif"
}

export interface User {
  uid: string;
  fullname: string;
  email: string;
  profileImageUrl?: string;
  photoURL?: string;
  isAdmin: boolean;
  phoneNumber: string;
  bio: string;
  skills: string[];
  availabilityStatus: AvailabilityStatus;
  employmentType: EmploymentType;
  staffId: string;
  bankName: string;
  bankAccountNumber: string;
  homeAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  amount: number;
  deadline: Date;
  status: TaskStatus;
  paymentStatus: TaskPaymentStatus;
  skills: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToStaffId: string | null;
  assignedAt?: Date;
  startDate?: Date;
  completedAt?: Date;
  submittedAt?: Date;
  submissionNotes?: string;
  adminFeedback?: string;
  reviewedAt?: Date;
  reviewedBy?: {
    uid: string;
    fullname: string;
    staffId: string;
  };
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  userId: string;
  files: string[];
  notes: string;
  submittedAt: Date;
}

export interface TaskMessage {
  id: string;
  taskId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  fileUrl?: string;
  fileName?: string;
}

export interface ClockInRecord {
  id: string;
  userId: string;
  clockInTime: Date;
  clockOutTime?: Date;
  totalMinutes?: number;
  location?: string;
  notes?: string;
  date: string; // YYYY-MM-DD format
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task' | 'payment' | 'system';
  isRead: boolean;
  createdAt: Date;
  relatedId?: string;
}

export interface Payment {
  id: string;
  userId: string;
  taskId: string;
  amount: number;
  status: 'pending' | 'completed';
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export enum WorkSessionError {
  NO_ACTIVE_SESSION = "Tiada sesi aktif untuk tamat kerja",
  DAILY_LIMIT_EXCEEDED = "Had harian telah dicapai",
  SESSION_LIMIT_REACHED = "Had sesi telah dicapai",
  MONTHLY_MINIMUM_NOT_MET = "Minimum jam bulanan tidak mencukupi",
  OUTSIDE_WORKING_HOURS = "Sesi kerja hanya dibenarkan antara 10:00 pagi hingga 10:00 malam",
  SESSION_IN_PROGRESS = "Anda masih dalam sesi kerja",
  MINIMUM_REST_PERIOD_NOT_MET = "Sila tunggu selepas sesi sebelumnya selesai",
  WEEKLY_LIMIT_EXCEEDED = "Had masa mingguan telah dicapai",
  UNKNOWN = "Ralat tidak diketahui"
}