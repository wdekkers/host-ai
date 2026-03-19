import { z } from 'zod';

export const taskSuggestionSourceSchema = z.enum(['message', 'reservation']);
export const taskSuggestionStatusSchema = z.enum(['pending', 'accepted', 'dismissed']);

export const taskSuggestionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  propertyId: z.string(),
  propertyName: z.string(),
  reservationId: z.string(),
  messageId: z.string().uuid().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  suggestedDueDate: z.string().datetime().nullish(),
  source: taskSuggestionSourceSchema,
  status: taskSuggestionStatusSchema,
  createdAt: z.string().datetime(),
});

export const taskReminderSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string(),
  organizationId: z.string(),
  taskTitle: z.string(),
  propertyName: z.string(),
  channels: z.array(z.enum(['sms', 'email'])),
  scheduledFor: z.string().datetime(),
  sentAt: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
});

export const acceptSuggestionInputSchema = z.object({
  reminderChannels: z.array(z.enum(['sms', 'email'])).optional(),
  reminderTime: z.string().datetime().optional(),
});

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>;
export type TaskReminder = z.infer<typeof taskReminderSchema>;
export type AcceptSuggestionInput = z.infer<typeof acceptSuggestionInputSchema>;
