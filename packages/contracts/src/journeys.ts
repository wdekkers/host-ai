import { z } from 'zod';

// ── Day of Week ──

export const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

// ── Journey Step ──

export const journeyStepTypeSchema = z.enum([
  'send_message',
  'wait',
  'ai_decision',
  'create_task',
  'send_notification',
  'upsell_offer',
  'pause_ai',
  'resume_ai',
]);
export type JourneyStepType = z.infer<typeof journeyStepTypeSchema>;

export const journeyStepSchema = z.object({
  type: journeyStepTypeSchema,
  directive: z.union([z.string(), z.record(z.string(), z.unknown())]),
  skipToStep: z.number().int().optional(),
});
export type JourneyStep = z.infer<typeof journeyStepSchema>;

// ── Trigger Types ──

export const triggerTypeSchema = z.enum([
  'booking_confirmed',
  'check_in_approaching',
  'check_in',
  'check_out_approaching',
  'check_out',
  'message_received',
  'gap_detected',
  'sentiment_changed',
  'booking_cancelled',
  'manual',
]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

export const triggerConfigSchema = z.object({
  triggerType: triggerTypeSchema,
  config: z.record(z.string(), z.unknown()),
});
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

// ── Coverage Schedule ──

export const coverageWindowSchema = z.object({
  days: z.array(dayOfWeekSchema).min(1),
  startHour: z.number().int().min(0).max(24),
  endHour: z.number().int().min(1).max(24),
});
export type CoverageWindow = z.infer<typeof coverageWindowSchema>;

export const coverageScheduleSchema = z.object({
  timezone: z.string().min(1),
  windows: z.array(coverageWindowSchema).min(1),
});
export type CoverageSchedule = z.infer<typeof coverageScheduleSchema>;

// ── Approval Mode ──

export const approvalModeSchema = z.enum(['draft', 'auto_with_exceptions', 'autonomous']);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

// ── Journey Definition ──

export const journeyDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: triggerTypeSchema,
  triggerConfig: z.record(z.string(), z.unknown()),
  steps: z.array(journeyStepSchema).min(1),
  coverageSchedule: coverageScheduleSchema.nullable(),
  approvalMode: approvalModeSchema.default('draft'),
});
export type JourneyDefinition = z.infer<typeof journeyDefinitionSchema>;

// ── Enrollment Status ──

export const enrollmentStatusSchema = z.enum(['active', 'completed', 'cancelled', 'paused']);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

// ── Execution Action ──

export const executionActionSchema = z.enum([
  'message_drafted',
  'message_sent',
  'task_created',
  'notification_sent',
  'ai_decision',
  'ai_paused',
  'ai_resumed',
  'skipped',
  'escalated',
  'failed',
]);
export type ExecutionAction = z.infer<typeof executionActionSchema>;

// ── Upsell ──

export const upsellTypeSchema = z.enum([
  'gap_night',
  'early_checkin',
  'late_checkout',
  'stay_extension',
  'custom',
]);
export type UpsellType = z.infer<typeof upsellTypeSchema>;

export const upsellStatusSchema = z.enum(['offered', 'accepted', 'declined', 'expired']);
export type UpsellStatus = z.infer<typeof upsellStatusSchema>;

// ── AI Status ──

export const aiStatusSchema = z.enum(['active', 'paused']);
export type AiStatus = z.infer<typeof aiStatusSchema>;

// ── API Input Schemas ──

export const generateJourneyInputSchema = z.object({
  prompt: z.string().min(10),
  propertyIds: z.array(z.string()).default([]),
});
export type GenerateJourneyInput = z.infer<typeof generateJourneyInputSchema>;

export const editJourneyInputSchema = z.object({
  journeyId: z.string().uuid(),
  instruction: z.string().min(5),
});
export type EditJourneyInput = z.infer<typeof editJourneyInputSchema>;

export const updateAiStatusInputSchema = z.object({
  conversationId: z.string().uuid(),
  status: aiStatusSchema,
});
export type UpdateAiStatusInput = z.infer<typeof updateAiStatusInputSchema>;

export const updateUpsellInputSchema = z.object({
  upsellId: z.string().uuid(),
  status: upsellStatusSchema,
});
export type UpdateUpsellInput = z.infer<typeof updateUpsellInputSchema>;
