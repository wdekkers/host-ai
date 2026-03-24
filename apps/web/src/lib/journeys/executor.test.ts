import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeStep } from './executor';
import type { ExecutorDeps } from './executor';
import type { JourneyStep } from '@walt/contracts';

function createMockDeps(overrides: Partial<ExecutorDeps> = {}): ExecutorDeps {
  return {
    generateMessage: async () => ({ suggestion: 'Hello!', sourcesUsed: [] }),
    createDraft: async () => {},
    sendMessage: async () => {},
    createTask: async () => {},
    sendNotification: async () => {},
    checkAiStatus: async () => 'active',
    checkRateLimit: async () => false,
    getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
    makeAiDecision: async () => ({ decision: true, reasoning: 'ok' }),
    setAiStatus: async () => {},
    ...overrides,
  };
}

const baseEnrollment = {
  id: 'enroll-1',
  journeyId: 'journey-1',
  reservationId: 'res-1',
  organizationId: 'org-1',
  context: {},
};

void describe('executeStep', () => {
  void it('send_message creates draft in draft mode', async () => {
    let draftCalled = false;
    let sendCalled = false;

    const deps = createMockDeps({
      createDraft: async () => { draftCalled = true; },
      sendMessage: async () => { sendCalled = true; },
    });

    const step: JourneyStep = {
      type: 'send_message',
      directive: 'Say hello to the guest',
    };

    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'draft', deps });

    assert.equal(result.action, 'message_drafted');
    assert.equal(draftCalled, true);
    assert.equal(sendCalled, false);
  });

  void it('send_message defers when AI is paused', async () => {
    const deps = createMockDeps({
      checkAiStatus: async () => 'paused',
    });

    const step: JourneyStep = {
      type: 'send_message',
      directive: 'Say hello to the guest',
    };

    const before = new Date();
    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });
    const after = new Date();

    assert.equal(result.action, 'skipped');
    assert.equal(result.deferred, true);
    assert.ok(result.nextExecutionAt instanceof Date);
    // Should be ~15 minutes from now
    const diffMs = result.nextExecutionAt!.getTime() - before.getTime();
    assert.ok(diffMs >= 14 * 60 * 1000, `Expected >= 14min, got ${diffMs}ms`);
    assert.ok(result.nextExecutionAt!.getTime() <= after.getTime() + 16 * 60 * 1000, 'Expected <= 16min from now');
  });

  void it('send_message defers when rate limited', async () => {
    const deps = createMockDeps({
      checkRateLimit: async () => true,
    });

    const step: JourneyStep = {
      type: 'send_message',
      directive: 'Say hello to the guest',
    };

    const before = new Date();
    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });

    assert.equal(result.action, 'skipped');
    assert.equal(result.deferred, true);
    assert.ok(result.nextExecutionAt instanceof Date);
    const diffMs = result.nextExecutionAt!.getTime() - before.getTime();
    assert.ok(diffMs >= 14 * 60 * 1000, `Expected >= 14min, got ${diffMs}ms`);
  });

  void it('wait calculates next execution time from delayMinutes', async () => {
    const deps = createMockDeps();

    const step: JourneyStep = {
      type: 'wait',
      directive: { delayMinutes: 30 },
    };

    const before = new Date();
    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'draft', deps });
    const after = new Date();

    assert.equal(result.action, 'skipped');
    assert.ok(result.nextExecutionAt instanceof Date);
    const diffMs = result.nextExecutionAt!.getTime() - before.getTime();
    assert.ok(diffMs >= 29 * 60 * 1000, `Expected >= 29min, got ${diffMs}ms`);
    assert.ok(result.nextExecutionAt!.getTime() <= after.getTime() + 31 * 60 * 1000, 'Expected <= 31min from now');
  });

  void it('ai_decision advances when true and skips when false', async () => {
    const deps = createMockDeps({
      makeAiDecision: async () => ({ decision: true, reasoning: 'Looks good' }),
    });

    const step: JourneyStep = {
      type: 'ai_decision',
      directive: 'Should we offer an upsell?',
      skipToStep: 5,
    };

    const resultTrue = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });

    assert.equal(resultTrue.action, 'ai_decision');
    assert.deepEqual(resultTrue.output, { decision: true, reasoning: 'Looks good' });
    assert.equal(resultTrue.skipToStep, undefined);

    const depsWithFalse = createMockDeps({
      makeAiDecision: async () => ({ decision: false, reasoning: 'Not appropriate' }),
    });

    const resultFalse = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps: depsWithFalse });

    assert.equal(resultFalse.action, 'ai_decision');
    assert.deepEqual(resultFalse.output, { decision: false, reasoning: 'Not appropriate' });
    assert.equal(resultFalse.skipToStep, 5);
  });

  void it('create_task calls createTask dep', async () => {
    let capturedTitle = '';
    let capturedPriority = '';

    const deps = createMockDeps({
      createTask: async (title, priority) => {
        capturedTitle = title;
        capturedPriority = priority;
      },
    });

    const step: JourneyStep = {
      type: 'create_task',
      directive: { title: 'Follow up with guest', priority: 'high' },
    };

    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });

    assert.equal(result.action, 'task_created');
    assert.equal(capturedTitle, 'Follow up with guest');
    assert.equal(capturedPriority, 'high');
  });

  void it('pause_ai calls setAiStatus with paused', async () => {
    let capturedStatus = '';

    const deps = createMockDeps({
      setAiStatus: async (_reservationId, status) => {
        capturedStatus = status;
      },
    });

    const step: JourneyStep = {
      type: 'pause_ai',
      directive: {},
    };

    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });

    assert.equal(result.action, 'ai_paused');
    assert.equal(capturedStatus, 'paused');
  });

  void it('resume_ai calls setAiStatus with active', async () => {
    let capturedStatus = '';

    const deps = createMockDeps({
      setAiStatus: async (_reservationId, status) => {
        capturedStatus = status;
      },
    });

    const step: JourneyStep = {
      type: 'resume_ai',
      directive: {},
    };

    const result = await executeStep(step, { enrollment: baseEnrollment, approvalMode: 'autonomous', deps });

    assert.equal(result.action, 'ai_resumed');
    assert.equal(capturedStatus, 'active');
  });
});
