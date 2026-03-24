export type NotificationChannel = 'sms' | 'email' | 'slack' | 'web';

export interface Notification {
  organizationId: string;
  recipientId?: string;
  channels: NotificationChannel[];
  category: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  urgency: 'low' | 'normal' | 'high';
}

export interface NotificationPreference {
  channels: NotificationChannel[];
  quietHours?: { timezone: string; startHour: number; endHour: number } | null;
}
