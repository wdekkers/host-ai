import type { JourneyStep, ApprovalMode } from '@walt/contracts';

type EnrollmentContext = {
  id: string;
  journeyId: string;
  reservationId: string;
  organizationId: string;
  context: Record<string, unknown>;
};

type CalendarData = {
  nightBeforeFree: boolean;
  nightAfterFree: boolean;
};

type AiDecisionResult = {
  decision: boolean;
  reasoning: string;
};

export type ExecutorDeps = {
  generateMessage: (directive: string) => Promise<{ suggestion: string; sourcesUsed: Array<Record<string, unknown>> } | null>;
  createDraft: (suggestion: string, sourcesUsed: Array<Record<string, unknown>>) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  createTask: (title: string, priority: string, description?: string) => Promise<void>;
  sendNotification: (channels: string[], message: string) => Promise<void>;
  checkAiStatus: (reservationId: string) => Promise<'active' | 'paused'>;
  checkRateLimit: (reservationId: string) => Promise<boolean>;
  getCalendarData: (reservationId: string) => Promise<CalendarData>;
  makeAiDecision: (directive: string, calendarData: CalendarData) => Promise<AiDecisionResult>;
  setAiStatus: (reservationId: string, status: 'active' | 'paused', reason?: string) => Promise<void>;
};

export type StepResult = {
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  nextExecutionAt?: Date;
  deferred?: boolean;
  skipToStep?: number;
};

type ExecuteStepOptions = {
  enrollment: EnrollmentContext;
  approvalMode: ApprovalMode;
  deps: ExecutorDeps;
};

function deferredResult(): StepResult {
  const nextExecutionAt = new Date(Date.now() + 15 * 60 * 1000);
  return { action: 'skipped', deferred: true, nextExecutionAt };
}

async function handleSendMessage(
  step: JourneyStep,
  opts: ExecuteStepOptions,
): Promise<StepResult> {
  const { enrollment, approvalMode, deps } = opts;

  const aiStatus = await deps.checkAiStatus(enrollment.reservationId);
  if (aiStatus === 'paused') {
    return deferredResult();
  }

  const isRateLimited = await deps.checkRateLimit(enrollment.reservationId);
  if (isRateLimited) {
    return deferredResult();
  }

  const directive = typeof step.directive === 'string' ? step.directive : JSON.stringify(step.directive);
  const result = await deps.generateMessage(directive);

  if (!result) {
    return { action: 'failed', output: { error: 'AI generation returned null' } };
  }

  const { suggestion, sourcesUsed } = result;

  if (approvalMode === 'draft') {
    await deps.createDraft(suggestion, sourcesUsed);
    return { action: 'message_drafted' };
  }

  await deps.sendMessage(suggestion);
  return { action: 'message_sent' };
}

async function handleWait(step: JourneyStep): Promise<StepResult> {
  const directive = typeof step.directive === 'string'
    ? (JSON.parse(step.directive) as Record<string, unknown>)
    : (step.directive as Record<string, unknown>);

  if (typeof directive.delayMinutes === 'number') {
    const nextExecutionAt = new Date(Date.now() + directive.delayMinutes * 60 * 1000);
    return { action: 'skipped', nextExecutionAt };
  }

  if (directive.until !== undefined) {
    const nextExecutionAt = new Date(Date.now() + 60 * 60 * 1000);
    return { action: 'skipped', nextExecutionAt };
  }

  return { action: 'skipped' };
}

async function handleAiDecision(
  step: JourneyStep,
  opts: ExecuteStepOptions,
): Promise<StepResult> {
  const { enrollment, deps } = opts;

  const calendarData = await deps.getCalendarData(enrollment.reservationId);
  const directive = typeof step.directive === 'string' ? step.directive : JSON.stringify(step.directive);
  const { decision, reasoning } = await deps.makeAiDecision(directive, calendarData);

  if (decision) {
    return { action: 'ai_decision', output: { decision: true, reasoning } };
  }

  return {
    action: 'ai_decision',
    output: { decision: false, reasoning },
    skipToStep: step.skipToStep,
  };
}

async function handleCreateTask(
  step: JourneyStep,
  opts: ExecuteStepOptions,
): Promise<StepResult> {
  const { deps } = opts;

  const directive = typeof step.directive === 'string'
    ? (JSON.parse(step.directive) as Record<string, unknown>)
    : (step.directive as Record<string, unknown>);

  const title = typeof directive.title === 'string' ? directive.title : 'Task';
  const priority = typeof directive.priority === 'string' ? directive.priority : 'normal';
  const description = typeof directive.description === 'string' ? directive.description : undefined;

  await deps.createTask(title, priority, description);
  return { action: 'task_created' };
}

async function handleSendNotification(
  step: JourneyStep,
  opts: ExecuteStepOptions,
): Promise<StepResult> {
  const { deps } = opts;

  const directive = typeof step.directive === 'string'
    ? (JSON.parse(step.directive) as Record<string, unknown>)
    : (step.directive as Record<string, unknown>);

  const channels = Array.isArray(directive.channels)
    ? (directive.channels as string[])
    : ['email'];
  const message = typeof directive.message === 'string' ? directive.message : '';

  await deps.sendNotification(channels, message);
  return { action: 'notification_sent' };
}

export async function executeStep(
  step: JourneyStep,
  opts: ExecuteStepOptions,
): Promise<StepResult> {
  const { enrollment, deps } = opts;

  switch (step.type) {
    case 'send_message':
    case 'upsell_offer':
      return handleSendMessage(step, opts);

    case 'wait':
      return handleWait(step);

    case 'ai_decision':
      return handleAiDecision(step, opts);

    case 'create_task':
      return handleCreateTask(step, opts);

    case 'send_notification':
      return handleSendNotification(step, opts);

    case 'pause_ai':
      await deps.setAiStatus(enrollment.reservationId, 'paused');
      return { action: 'ai_paused' };

    case 'resume_ai':
      await deps.setAiStatus(enrollment.reservationId, 'active');
      return { action: 'ai_resumed' };

    default: {
      const exhaustiveCheck: never = step.type;
      return { action: 'skipped', output: { error: `Unknown step type: ${String(exhaustiveCheck)}` } };
    }
  }
}
