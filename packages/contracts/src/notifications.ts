import { z } from 'zod';

const notificationChannelSchema = z.enum(['sms', 'email', 'slack', 'web']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const updateNotificationPreferencesInputSchema = z.object({
  category: z.string().min(1),
  channels: z.array(notificationChannelSchema).min(1),
  quietHours: z.object({
    timezone: z.string().min(1),
    startHour: z.number().int().min(0).max(24),
    endHour: z.number().int().min(0).max(24),
  }).nullable().optional(),
});
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesInputSchema>;
