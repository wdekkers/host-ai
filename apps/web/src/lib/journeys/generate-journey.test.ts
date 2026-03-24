import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateJourneyFromPrompt, type GenerateInput, type GenerateDeps } from './generate-journey';

const baseInput: GenerateInput = {
  prompt: 'Create a welcome journey that sends a greeting 24 hours before check-in',
  propertyIds: ['prop-1'],
  organizationId: 'org-1',
};

const validJourney = {
  name: 'Pre-Arrival Welcome',
  description: 'Sends a welcome message before check-in',
  triggerType: 'check_in_approaching',
  triggerConfig: {},
  steps: [
    { type: 'send_message', directive: 'Send a warm welcome to the guest' },
  ],
  coverageSchedule: null,
  approvalMode: 'draft',
};

void describe('generateJourneyFromPrompt', () => {
  void it('returns validated journey definition', async () => {
    const deps: GenerateDeps = {
      resolvePropertyContext: async () => 'Property: Palmera Villa, 3 bedrooms',
      callAI: async () =>
        JSON.stringify({
          journey: validJourney,
          considerations: ['Consider time zone differences for check-in time'],
        }),
    };

    const result = await generateJourneyFromPrompt(baseInput, deps);

    assert.ok(result.success === true);
    assert.equal(result.journey.name, 'Pre-Arrival Welcome');
    assert.equal(result.journey.steps.length, 1);
    assert.equal(result.journey.triggerType, 'check_in_approaching');
    assert.ok(Array.isArray(result.considerations));
    assert.ok(result.considerations.length > 0);
  });

  void it('returns error for invalid AI output', async () => {
    const deps: GenerateDeps = {
      resolvePropertyContext: async () => '',
      callAI: async () => 'This is not valid JSON {{{',
    };

    const result = await generateJourneyFromPrompt(baseInput, deps);

    assert.ok(result.success === false);
    assert.equal(result.error, 'AI returned invalid JSON');
  });

  void it('handles AI returning journey without wrapper', async () => {
    const deps: GenerateDeps = {
      resolvePropertyContext: async () => 'Property: Palmera Villa',
      callAI: async () => JSON.stringify(validJourney),
    };

    const result = await generateJourneyFromPrompt(baseInput, deps);

    assert.ok(result.success === true);
    assert.equal(result.journey.name, 'Pre-Arrival Welcome');
  });

  void it('returns error when AI call fails', async () => {
    const deps: GenerateDeps = {
      resolvePropertyContext: async () => '',
      callAI: async () => {
        throw new Error('AI service unavailable');
      },
    };

    const result = await generateJourneyFromPrompt(baseInput, deps);

    assert.ok(result.success === false);
    assert.ok(result.error.length > 0);
  });
});
