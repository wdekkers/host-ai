import { z } from 'zod';

export const knowledgeScopeSchema = z.enum(['global', 'property']);
export type KnowledgeScope = z.infer<typeof knowledgeScopeSchema>;

export const knowledgeEntryTypeSchema = z.enum([
  'faq',
  'guidebook',
  'policy',
  'amenity',
  'checkin',
  'checkout',
]);
export type KnowledgeEntryType = z.infer<typeof knowledgeEntryTypeSchema>;

export const knowledgeChannelSchema = z.enum(['ai', 'website', 'guidebook']);
export type KnowledgeChannel = z.infer<typeof knowledgeChannelSchema>;

export const knowledgeStatusSchema = z.enum(['draft', 'published', 'archived']);
export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>;

function validateKnowledgeScope(
  data: { scope?: KnowledgeScope; propertyId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.scope === 'property' && !data.propertyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'propertyId is required when scope is property',
      path: ['propertyId'],
    });
  }

  if (data.scope === 'global' && data.propertyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'propertyId must be empty when scope is global',
      path: ['propertyId'],
    });
  }
}

function validateKnowledgeContent(
  data: {
    entryType?: KnowledgeEntryType;
    question?: string | null;
    answer?: string | null;
    title?: string | null;
    body?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.entryType === 'faq') {
    if (!data.question?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'question is required for faq entries',
        path: ['question'],
      });
    }

    if (!data.answer?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'answer is required for faq entries',
        path: ['answer'],
      });
    }
  }

  if (data.entryType === 'guidebook') {
    if (!data.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'title is required for guidebook entries',
        path: ['title'],
      });
    }

    if (!data.body?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'body is required for guidebook entries',
        path: ['body'],
      });
    }
  }
}

export const knowledgeEntrySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  scope: knowledgeScopeSchema,
  propertyId: z.string().min(1).nullable(),
  entryType: knowledgeEntryTypeSchema,
  topicKey: z.string().min(1),
  title: z.string().min(1).nullable(),
  question: z.string().min(1).nullable(),
  answer: z.string().min(1).nullable(),
  body: z.string().min(1).nullable(),
  channels: z.array(knowledgeChannelSchema).min(1),
  status: knowledgeStatusSchema,
  sortOrder: z.number().int(),
  slug: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>;

export const createKnowledgeEntryInputSchema = z.object({
  scope: knowledgeScopeSchema,
  propertyId: z.string().min(1).nullable().optional(),
  entryType: knowledgeEntryTypeSchema,
  topicKey: z.string().min(1),
  title: z.string().min(1).optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  channels: z.array(knowledgeChannelSchema).min(1),
  status: knowledgeStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  slug: z.string().min(1).nullable().optional(),
}).superRefine((data, ctx) => {
  validateKnowledgeScope(data, ctx);
  validateKnowledgeContent(data, ctx);
});
export type CreateKnowledgeEntryInput = z.infer<typeof createKnowledgeEntryInputSchema>;

export const updateKnowledgeEntryInputSchema = z.object({
  scope: knowledgeScopeSchema.optional(),
  propertyId: z.string().min(1).nullable().optional(),
  entryType: knowledgeEntryTypeSchema.optional(),
  topicKey: z.string().min(1).optional(),
  title: z.string().min(1).nullable().optional(),
  question: z.string().min(1).nullable().optional(),
  answer: z.string().min(1).nullable().optional(),
  body: z.string().min(1).nullable().optional(),
  channels: z.array(knowledgeChannelSchema).min(1).optional(),
  status: knowledgeStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  slug: z.string().min(1).nullable().optional(),
}).superRefine((data, ctx) => {
  if ('propertyId' in data && data.scope === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scope is required when updating propertyId',
      path: ['scope'],
    });
  }

  validateKnowledgeScope(data, ctx);
  validateKnowledgeContent(data, ctx);
});
export type UpdateKnowledgeEntryInput = z.infer<typeof updateKnowledgeEntryInputSchema>;

export const knowledgeListQuerySchema = z.object({
  scope: knowledgeScopeSchema.optional(),
  propertyId: z.string().min(1).optional(),
  entryType: knowledgeEntryTypeSchema.optional(),
  channel: knowledgeChannelSchema.optional(),
  status: knowledgeStatusSchema.optional(),
  topicKey: z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  validateKnowledgeScope(data, ctx);
});
export type KnowledgeListQuery = z.infer<typeof knowledgeListQuerySchema>;
