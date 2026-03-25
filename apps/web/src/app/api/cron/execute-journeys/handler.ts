import { NextResponse } from 'next/server';
import { and, eq, lte, gte, inArray, sql } from 'drizzle-orm';
import {
  journeys,
  journeyEnrollments,
  journeyExecutionLog,
  conversationSettings,
  reservations,
  properties,
  knowledgeEntries,
  agentConfigs,
  messages,
  tasks,
} from '@walt/db';
import type { JourneyStep, ApprovalMode, CoverageSchedule } from '@walt/contracts';
import { journeyStepSchema, approvalModeSchema, coverageScheduleSchema } from '@walt/contracts';
import { executeStep } from '@/lib/journeys/executor';
import { isWithinCoverageWindow, getNextWindowStart } from '@/lib/journeys/coverage';
import {
  generateJourneyMessage,
  type GenerateJourneyMessageDeps,
} from '@/lib/journeys/generate-journey-message';

type Deps = {
  cronSecret?: string;
};

type EnrollmentRow = {
  id: string;
  journeyId: string;
  reservationId: string;
  organizationId: string;
  currentStepIndex: number;
  status: string;
  nextExecutionAt: Date | null;
  retryCount: number;
  context: Record<string, unknown>;
  journey: {
    id: string;
    steps: unknown;
    coverageSchedule: unknown;
    approvalMode: string;
    organizationId: string;
  };
};

export async function handleExecuteJourneys(request: Request, deps: Deps = {}): Promise<Response> {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const now = new Date();

  // Query due enrollments joined with their journey definition
  const dueEnrollments = await db
    .select({
      id: journeyEnrollments.id,
      journeyId: journeyEnrollments.journeyId,
      reservationId: journeyEnrollments.reservationId,
      organizationId: journeyEnrollments.organizationId,
      currentStepIndex: journeyEnrollments.currentStepIndex,
      status: journeyEnrollments.status,
      nextExecutionAt: journeyEnrollments.nextExecutionAt,
      retryCount: journeyEnrollments.retryCount,
      context: journeyEnrollments.context,
      journey: {
        id: journeys.id,
        steps: journeys.steps,
        coverageSchedule: journeys.coverageSchedule,
        approvalMode: journeys.approvalMode,
        organizationId: journeys.organizationId,
      },
    })
    .from(journeyEnrollments)
    .innerJoin(journeys, eq(journeyEnrollments.journeyId, journeys.id))
    .where(
      and(
        eq(journeyEnrollments.status, 'active'),
        lte(journeyEnrollments.nextExecutionAt, now),
      ),
    )
    .limit(50);

  let processed = 0;
  let failed = 0;

  for (const enrollment of dueEnrollments as EnrollmentRow[]) {
    try {
      // Resolve steps: prefer stepsSnapshot from context, fall back to journey's current steps
      const contextData = enrollment.context;
      const rawSteps =
        Array.isArray(contextData.stepsSnapshot)
          ? contextData.stepsSnapshot
          : enrollment.journey.steps;

      // Parse steps array
      const stepsParseResult = Array.isArray(rawSteps)
        ? rawSteps.map((s: unknown) => journeyStepSchema.safeParse(s))
        : [];
      const steps: JourneyStep[] = stepsParseResult
        .filter((r): r is { success: true; data: JourneyStep } => r.success)
        .map((r) => r.data);

      // Parse coverage schedule
      const parsedCoverage = coverageScheduleSchema.safeParse(enrollment.journey.coverageSchedule);
      const coverageSchedule: CoverageSchedule | null = parsedCoverage.success
        ? parsedCoverage.data
        : null;

      // Check coverage window
      if (coverageSchedule !== null && !isWithinCoverageWindow(coverageSchedule, now)) {
        const nextAt = getNextWindowStart(coverageSchedule, now);
        await db
          .update(journeyEnrollments)
          .set({ nextExecutionAt: nextAt })
          .where(eq(journeyEnrollments.id, enrollment.id));
        processed++;
        continue;
      }

      // Get the current step
      const step = steps[enrollment.currentStepIndex];
      if (!step) {
        // No step at this index — enrollment is complete
        await db
          .update(journeyEnrollments)
          .set({
            status: 'completed',
            completedAt: now,
          })
          .where(eq(journeyEnrollments.id, enrollment.id));
        processed++;
        continue;
      }

      // Parse approval mode
      const approvalModeResult = approvalModeSchema.safeParse(enrollment.journey.approvalMode);
      const approvalMode: ApprovalMode = approvalModeResult.success
        ? approvalModeResult.data
        : 'draft';

      // Resolve reservation context once (shared across deps)
      const [reservationRow] = await db
        .select({
          id: reservations.id,
          propertyId: reservations.propertyId,
          guestFirstName: reservations.guestFirstName,
          checkIn: reservations.checkIn,
          checkOut: reservations.checkOut,
          conversationId: reservations.conversationId,
        })
        .from(reservations)
        .where(eq(reservations.id, enrollment.reservationId))
        .limit(1);

      const propertyId = reservationRow?.propertyId ?? null;

      const [propRow] = propertyId
        ? await db
            .select({ name: properties.name })
            .from(properties)
            .where(eq(properties.id, propertyId))
            .limit(1)
        : [undefined];

      const propertyName = propRow?.name ?? propertyId ?? 'the property';

      // Wire up executor deps
      const msgGenerateDeps: GenerateJourneyMessageDeps = {
        resolveKnowledge: async (orgId, propId) => {
          const conditions = [
            eq(knowledgeEntries.organizationId, orgId),
            eq(knowledgeEntries.status, 'published'),
          ];
          if (propId) {
            const rows = await db
              .select({
                id: knowledgeEntries.id,
                question: knowledgeEntries.question,
                answer: knowledgeEntries.answer,
                title: knowledgeEntries.title,
              })
              .from(knowledgeEntries)
              .where(
                and(
                  ...conditions,
                  inArray(knowledgeEntries.scope, ['global', 'property']),
                  // property-scoped entries for this property, or global entries
                  sql`(${knowledgeEntries.scope} = 'global' OR ${knowledgeEntries.propertyId} = ${propId})`,
                ),
              )
              .limit(20);
            return rows.map((r) => ({
              id: r.id,
              label: r.question ?? r.title ?? r.answer?.slice(0, 60) ?? 'Entry',
              snippet: r.answer ?? r.title ?? '',
            }));
          }
          const rows = await db
            .select({
              id: knowledgeEntries.id,
              question: knowledgeEntries.question,
              answer: knowledgeEntries.answer,
              title: knowledgeEntries.title,
            })
            .from(knowledgeEntries)
            .where(and(...conditions, eq(knowledgeEntries.scope, 'global')))
            .limit(20);
          return rows.map((r) => ({
            id: r.id,
            label: r.question ?? r.title ?? r.answer?.slice(0, 60) ?? 'Entry',
            snippet: r.answer ?? r.title ?? '',
          }));
        },

        resolvePropertyFacts: async (propId) => {
          if (!propId) return '';
          const [row] = await db
            .select({
              checkInTime: properties.checkInTime,
              checkOutTime: properties.checkOutTime,
              maxGuests: properties.maxGuests,
              bedrooms: properties.bedrooms,
              beds: properties.beds,
              bathrooms: properties.bathrooms,
              petsAllowed: properties.petsAllowed,
              smokingAllowed: properties.smokingAllowed,
              eventsAllowed: properties.eventsAllowed,
              amenities: properties.amenities,
              propertyType: properties.propertyType,
              hasPool: properties.hasPool,
              description: properties.description,
              timezone: properties.timezone,
              wifiName: properties.wifiName,
              wifiPassword: properties.wifiPassword,
              houseManual: properties.houseManual,
              guestAccess: properties.guestAccess,
              spaceOverview: properties.spaceOverview,
              neighborhoodDescription: properties.neighborhoodDescription,
              gettingAround: properties.gettingAround,
              additionalRules: properties.additionalRules,
            })
            .from(properties)
            .where(eq(properties.id, propId))
            .limit(1);
          if (!row) return '';
          const { formatPropertyFacts } = await import('@/lib/property-facts');
          return formatPropertyFacts(row);
        },

        resolveAgentConfig: async (orgId, propId) => {
          const globalConfig = await db
            .select({
              tone: agentConfigs.tone,
              emojiUse: agentConfigs.emojiUse,
              responseLength: agentConfigs.responseLength,
              specialInstructions: agentConfigs.specialInstructions,
            })
            .from(agentConfigs)
            .where(
              and(eq(agentConfigs.organizationId, orgId), eq(agentConfigs.scope, 'global')),
            )
            .limit(1);

          let config = globalConfig[0] ?? {
            tone: null,
            emojiUse: null,
            responseLength: null,
            specialInstructions: null,
          };

          if (propId) {
            const propConfig = await db
              .select({
                tone: agentConfigs.tone,
                emojiUse: agentConfigs.emojiUse,
                responseLength: agentConfigs.responseLength,
                specialInstructions: agentConfigs.specialInstructions,
              })
              .from(agentConfigs)
              .where(
                and(
                  eq(agentConfigs.organizationId, orgId),
                  eq(agentConfigs.scope, 'property'),
                  eq(agentConfigs.propertyId, propId),
                ),
              )
              .limit(1);
            if (propConfig[0]) {
              config = {
                tone: propConfig[0].tone ?? config.tone,
                emojiUse: propConfig[0].emojiUse ?? config.emojiUse,
                responseLength: propConfig[0].responseLength ?? config.responseLength,
                specialInstructions:
                  propConfig[0].specialInstructions ?? config.specialInstructions,
              };
            }
          }

          return config;
        },

        callAI: async (msgs) => {
          // TODO: implement with real API — dynamic import to avoid bundling at the top level
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            console.warn('[execute-journeys] OPENAI_API_KEY not set — skipping AI call');
            return null;
          }
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({ apiKey });
          const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: msgs,
          });
          return response.choices[0]?.message?.content ?? null;
        },
      };

      // Resolve conversation history for this reservation
      const conversationHistory = await db
        .select({ body: messages.body, senderType: messages.senderType })
        .from(messages)
        .where(eq(messages.reservationId, enrollment.reservationId))
        .orderBy(messages.createdAt)
        .limit(20);

      const executorDeps = {
        generateMessage: async (directive: string) => {
          return generateJourneyMessage(
            {
              directive,
              guestFirstName: reservationRow?.guestFirstName ?? null,
              propertyName,
              propertyId,
              organizationId: enrollment.organizationId,
              checkIn: reservationRow?.checkIn ?? null,
              checkOut: reservationRow?.checkOut ?? null,
              conversationHistory,
            },
            msgGenerateDeps,
          );
        },

        createDraft: async (suggestion: string, sourcesUsed: Array<Record<string, unknown>>) => {
          // Insert a draft message record into the messages table
          const messageId = crypto.randomUUID();
          await db.insert(messages).values({
            id: messageId as unknown as string,
            reservationId: enrollment.reservationId,
            body: suggestion,
            senderType: 'host',
            createdAt: now,
            raw: {},
            suggestion,
            suggestionGeneratedAt: now,
            draftStatus: 'pending_review',
            sourcesUsed: sourcesUsed as never,
          } as typeof messages.$inferInsert);
        },

        sendMessage: async (body: string) => {
          // TODO: implement with real API — send via Hospitable API
          console.log(
            `[execute-journeys] sendMessage reservationId=${enrollment.reservationId} body=${body.slice(0, 80)}`,
          );
        },

        createTask: async (title: string, priority: string, description?: string) => {
          await db.insert(tasks).values({
            id: crypto.randomUUID(),
            organizationId: enrollment.organizationId,
            title,
            description: description ?? null,
            priority,
            status: 'open',
            propertyIds: propertyId ? [propertyId] : [],
            createdAt: now,
            createdBy: 'journey-cron',
            updatedAt: now,
            updatedBy: 'journey-cron',
          });
        },

        sendNotification: async (channels: string[], message: string) => {
          // TODO: implement with real @walt/notifications router
          console.log(
            `[execute-journeys] sendNotification channels=${channels.join(',')} message=${message.slice(0, 80)}`,
          );
        },

        checkAiStatus: async (resId: string): Promise<'active' | 'paused'> => {
          const [setting] = await db
            .select({ aiStatus: conversationSettings.aiStatus })
            .from(conversationSettings)
            .where(eq(conversationSettings.reservationId, resId))
            .limit(1);
          if (!setting) return 'active';
          return setting.aiStatus === 'paused' ? 'paused' : 'active';
        },

        checkRateLimit: async (resId: string): Promise<boolean> => {
          const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
          const recentLogs = await db
            .select({ id: journeyExecutionLog.id })
            .from(journeyExecutionLog)
            .where(
              and(
                eq(journeyExecutionLog.reservationId, resId),
                inArray(journeyExecutionLog.action, ['message_drafted', 'message_sent']),
                gte(journeyExecutionLog.createdAt, fifteenMinutesAgo),
              ),
            )
            .limit(1);
          return recentLogs.length > 0;
        },

        getCalendarData: async (_resId: string) => {
          // TODO: implement with real calendar query — check adjacent nights
          // Placeholder: assume both nights are occupied for safety
          console.log(`[execute-journeys] getCalendarData reservationId=${_resId} (placeholder)`);
          return { nightBeforeFree: false, nightAfterFree: false };
        },

        makeAiDecision: async (directive: string, calendarData: { nightBeforeFree: boolean; nightAfterFree: boolean }) => {
          // TODO: implement with real API — call OpenAI with directive + context
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            console.warn('[execute-journeys] OPENAI_API_KEY not set — defaulting AI decision to false');
            return { decision: false, reasoning: 'API key not configured' };
          }
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({ apiKey });
          const prompt = `You are an AI making a binary decision for a short-term rental journey step.

Calendar data:
- Night before reservation is free: ${calendarData.nightBeforeFree}
- Night after reservation is free: ${calendarData.nightAfterFree}

Directive: ${directive}

Respond with a JSON object: { "decision": true|false, "reasoning": "brief explanation" }`;
          const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          });
          const content = response.choices[0]?.message?.content ?? '{}';
          try {
            const parsed = JSON.parse(content) as { decision?: boolean; reasoning?: string };
            return {
              decision: parsed.decision === true,
              reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
            };
          } catch {
            return { decision: false, reasoning: 'Failed to parse AI response' };
          }
        },

        setAiStatus: async (resId: string, status: 'active' | 'paused') => {
          await db
            .insert(conversationSettings)
            .values({
              reservationId: resId,
              organizationId: enrollment.organizationId,
              aiStatus: status,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: conversationSettings.reservationId,
              set: { aiStatus: status, updatedAt: now },
            });
        },
      };

      // Execute the step
      const result = await executeStep(step, {
        enrollment: {
          id: enrollment.id,
          journeyId: enrollment.journeyId,
          reservationId: enrollment.reservationId,
          organizationId: enrollment.organizationId,
          context: enrollment.context,
        },
        approvalMode,
        deps: executorDeps,
      });

      // Map StepResult action to ExecutionAction (normalise 'skipped' variant)
      const logAction = result.action as string;

      // Insert execution log entry
      await db.insert(journeyExecutionLog).values({
        id: crypto.randomUUID(),
        enrollmentId: enrollment.id,
        journeyId: enrollment.journeyId,
        organizationId: enrollment.organizationId,
        reservationId: enrollment.reservationId,
        stepIndex: enrollment.currentStepIndex,
        action: logAction,
        input: { stepType: step.type, directive: step.directive } as never,
        output: result.output as never ?? null,
        createdAt: now,
      });

      // Handle result
      if (result.deferred && result.nextExecutionAt) {
        await db
          .update(journeyEnrollments)
          .set({ nextExecutionAt: result.nextExecutionAt })
          .where(eq(journeyEnrollments.id, enrollment.id));
      } else if (result.action === 'failed') {
        const newRetryCount = enrollment.retryCount + 1;
        if (newRetryCount >= 3) {
          await db
            .update(journeyEnrollments)
            .set({ status: 'paused', retryCount: newRetryCount })
            .where(eq(journeyEnrollments.id, enrollment.id));
          // Send paused notification
          console.log(
            `[execute-journeys] enrollment ${enrollment.id} paused after 3 retries`,
          );
        } else {
          // Retry in 15 minutes
          const retryAt = new Date(now.getTime() + 15 * 60 * 1000);
          await db
            .update(journeyEnrollments)
            .set({ retryCount: newRetryCount, nextExecutionAt: retryAt })
            .where(eq(journeyEnrollments.id, enrollment.id));
        }
        failed++;
      } else {
        // Successful step — determine next step index
        let nextStepIndex: number;
        if (typeof result.skipToStep === 'number') {
          nextStepIndex = result.skipToStep;
        } else if (result.nextExecutionAt) {
          // Wait step with explicit next time — stay on current step index, just defer
          // (The wait step advances once the time is reached next execution)
          nextStepIndex = enrollment.currentStepIndex + 1;
          await db
            .update(journeyEnrollments)
            .set({
              currentStepIndex: nextStepIndex,
              retryCount: 0,
              nextExecutionAt: result.nextExecutionAt,
            })
            .where(eq(journeyEnrollments.id, enrollment.id));
          processed++;
          continue;
        } else {
          nextStepIndex = enrollment.currentStepIndex + 1;
        }

        if (nextStepIndex >= steps.length) {
          // Journey complete
          await db
            .update(journeyEnrollments)
            .set({
              currentStepIndex: nextStepIndex,
              status: 'completed',
              completedAt: now,
              retryCount: 0,
            })
            .where(eq(journeyEnrollments.id, enrollment.id));
        } else {
          // Advance to next step — execute immediately (next run)
          const nextExecutionAt = new Date(now.getTime() + 1000); // ~1s from now
          await db
            .update(journeyEnrollments)
            .set({
              currentStepIndex: nextStepIndex,
              retryCount: 0,
              nextExecutionAt,
            })
            .where(eq(journeyEnrollments.id, enrollment.id));
        }
        processed++;
      }
    } catch (err) {
      console.error(`[execute-journeys] error processing enrollment ${enrollment.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
