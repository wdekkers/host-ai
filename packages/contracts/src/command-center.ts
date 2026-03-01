import { z } from 'zod';

export const draftStatusSchema = z.enum(['pending', 'edited', 'approved', 'sent', 'rejected']);
export type DraftStatus = z.infer<typeof draftStatusSchema>;

export const draftSourceSchema = z.object({
  type: z.enum(['policy', 'reservation', 'property-note']),
  label: z.string().min(1),
  snippet: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  referenceUrl: z.string().url().optional(),
  referenceId: z.string().min(1).optional()
});
export type DraftSource = z.infer<typeof draftSourceSchema>;

export const auditLogEntrySchema = z.object({
  action: z.enum(['created', 'edited', 'approved', 'sent', 'rejected']),
  actorId: z.string().min(1),
  timestamp: z.string().datetime(),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional()
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const queueItemSchema = z.object({
  id: z.string().min(1),
  reservationId: z.string().min(1),
  intent: z.string().min(1),
  body: z.string().min(1),
  status: draftStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sources: z.array(draftSourceSchema).min(1),
  auditLog: z.array(auditLogEntrySchema)
});
export type QueueItem = z.infer<typeof queueItemSchema>;

export const createDraftInputSchema = z.object({
  reservationId: z.string().min(1),
  intent: z.string().min(1),
  context: z.record(z.string(), z.unknown())
});
export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;

export const updateDraftInputSchema = z.object({
  action: z.enum(['edit', 'approve', 'send', 'reject']),
  actorId: z.string().min(1).default('host-user'),
  body: z.string().optional()
});
export type UpdateDraftInput = z.infer<typeof updateDraftInputSchema>;

export const incidentStateSchema = z.enum([
  'active',
  'negotiation',
  'resolution-accepted',
  'recovery-closed',
  'normalized'
]);
export type IncidentState = z.infer<typeof incidentStateSchema>;

export const createIncidentInputSchema = z.object({
  summary: z.string().min(1)
});
export type CreateIncidentInput = z.infer<typeof createIncidentInputSchema>;

export const transitionIncidentInputSchema = z.object({
  next: incidentStateSchema
});
export type TransitionIncidentInput = z.infer<typeof transitionIncidentInputSchema>;

export const riskRecommendationInputSchema = z.object({
  globalTrustScore: z.number().min(0).max(100),
  localRiskTolerance: z.number().min(0).max(100),
  localIncidentSignals: z.number().min(0)
});
export type RiskRecommendationInput = z.infer<typeof riskRecommendationInputSchema>;

export const strategyRecommendationInputSchema = z.object({
  localSeverity: z.number().min(0).max(100),
  portfolioTrend: z.enum(['low-risk', 'high-risk']),
  portfolioConfidence: z.number().min(0).max(100)
});
export type StrategyRecommendationInput = z.infer<typeof strategyRecommendationInputSchema>;

export const experienceRiskInputSchema = z.object({
  fixImpact: z.number().min(0).max(100),
  guestSensitivity: z.number().min(0).max(100),
  nightsRemaining: z.number().int().min(1).max(60)
});
export type ExperienceRiskInput = z.infer<typeof experienceRiskInputSchema>;

export const rolloutActionInputSchema = z.object({
  action: z.literal('complete-internal-validation')
});
export type RolloutActionInput = z.infer<typeof rolloutActionInputSchema>;

export const hostOnboardingInputSchema = z.object({
  hostId: z.string().min(1)
});
export type HostOnboardingInput = z.infer<typeof hostOnboardingInputSchema>;

export const roiUpdateInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('refund'),
    amount: z.number().min(0)
  }),
  z.object({
    action: z.literal('review'),
    rating: z.number().min(1).max(5)
  })
]);
export type RoiUpdateInput = z.infer<typeof roiUpdateInputSchema>;
