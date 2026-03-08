import { z } from 'zod';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

import {
  getPropertyBrainCompletenessInSingleton,
  getPropertyBrainProfileInSingleton,
  updatePropertyBrainProfileInSingleton,
} from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

const priceTierSchema = z.object({
  fromHour: z.number().int().min(0).max(23),
  toHour: z.number().int().min(0).max(23),
  amountUsd: z.number().min(0),
});

const updatePropertyBrainSchema = z.object({
  coreRules: z
    .object({
      checkInTime: z.string().min(1).optional(),
      checkOutTime: z.string().min(1).optional(),
      maxOccupancy: z.number().int().min(1).optional(),
      quietHours: z.string().min(1).optional(),
      houseRules: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  earlyLatePolicy: z
    .object({
      earlyCheckIn: z
        .object({
          earliestTime: z.string().min(1),
          latestTime: z.string().min(1),
          priceTiers: z.array(priceTierSchema).min(1),
        })
        .optional(),
      lateCheckout: z
        .object({
          earliestTime: z.string().min(1),
          latestTime: z.string().min(1),
          priceTiers: z.array(priceTierSchema).min(1),
        })
        .optional(),
    })
    .optional(),
  arrivalGuide: z
    .object({
      entryMethod: z.string().min(1).optional(),
      lockInstructions: z.string().min(1).optional(),
      parkingInstructions: z.string().min(1).optional(),
      accessNotes: z.string().min(1).optional(),
    })
    .optional(),
  cleanerPreferences: z
    .object({
      channel: z.enum(['sms', 'whatsapp', 'call']).optional(),
      contact: z.string().min(1).optional(),
      requiredFormat: z.string().min(1).optional(),
      escalationAfterMinutes: z.number().int().min(1).max(120).optional(),
    })
    .optional(),
  amenityPolicies: z
    .object({
      poolHeating: z
        .object({
          available: z.boolean(),
          temperatureRangeF: z.string().min(1).optional(),
          leadTimeHours: z.number().int().min(0).max(72).optional(),
          caveats: z.array(z.string().min(1)).default([]),
        })
        .optional(),
      hotTub: z
        .object({
          available: z.boolean(),
          maxOccupancy: z.number().int().min(1).max(20).optional(),
          safetyNotes: z.array(z.string().min(1)).default([]),
        })
        .optional(),
      sauna: z
        .object({
          available: z.boolean(),
          safetyNotes: z.array(z.string().min(1)).default([]),
        })
        .optional(),
    })
    .optional(),
  amenityImportanceIndex: z
    .record(z.string().min(1), z.enum(['critical', 'important', 'enhancer']))
    .optional(),
  voiceProfile: z
    .object({
      tone: z.enum(['warm', 'neutral', 'formal']).optional(),
      emojiUse: z.enum(['none', 'light', 'friendly']).optional(),
      strictness: z.enum(['strict', 'balanced', 'flexible']).optional(),
      apologyStyle: z.enum(['brief', 'empathetic', 'formal']).optional(),
    })
    .optional(),
  escalationMatrix: z
    .object({
      alwaysManualScenarios: z.array(z.string().min(1)).optional(),
      escalationChannel: z.string().min(1).optional(),
    })
    .optional(),
});

export const GET = withPermission(
  'dashboard.read',
  async (_request: Request, { params }: Params) => {
    const { id } = await params;
    return NextResponse.json({
      profile: getPropertyBrainProfileInSingleton(id),
      completeness: getPropertyBrainCompletenessInSingleton(id),
    });
  },
);

export const PATCH = withPermission(
  'platform.configure',
  async (request: Request, { params }: Params, authContext) => {
    const { id } = await params;
    try {
      const rawBody = (await request.json()) as { actorId?: unknown };
      const parsed = updatePropertyBrainSchema.parse(rawBody);
      const actorId =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.actorId === 'string' &&
        rawBody.actorId.length > 0
          ? rawBody.actorId
          : authContext.userId;
      const profile = updatePropertyBrainProfileInSingleton(
        id,
        {
          coreRules: parsed.coreRules,
          earlyLatePolicy: parsed.earlyLatePolicy,
          arrivalGuide: parsed.arrivalGuide,
          cleanerPreferences: parsed.cleanerPreferences,
          amenityPolicies: parsed.amenityPolicies,
          amenityImportanceIndex: parsed.amenityImportanceIndex,
          voiceProfile: parsed.voiceProfile,
          escalationMatrix: parsed.escalationMatrix,
        },
        actorId,
      );
      return NextResponse.json({
        profile,
        completeness: getPropertyBrainCompletenessInSingleton(id),
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/property-brain/[id]' });
    }
  },
);
