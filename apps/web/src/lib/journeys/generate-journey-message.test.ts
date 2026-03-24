import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateJourneyMessage,
  type GenerateJourneyMessageInput,
  type GenerateJourneyMessageDeps,
} from './generate-journey-message.js';

const baseInput: GenerateJourneyMessageInput = {
  directive: 'Send a welcome message to the guest',
  guestFirstName: 'Alice',
  propertyName: 'Palmera Villa',
  propertyId: 'prop-1',
  organizationId: 'org-1',
  checkIn: new Date('2030-06-01'),
  checkOut: new Date('2030-06-07'),
  conversationHistory: [],
};

const makeKnowledgeEntry = (id: string) => ({
  id,
  label: `FAQ ${id}`,
  snippet: `Answer for ${id}`,
});

void describe('generateJourneyMessage', () => {
  void it('returns suggestion with sources', async () => {
    const entry = makeKnowledgeEntry('k1');
    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [entry],
      resolvePropertyFacts: async () => 'Check-in: 3pm',
      resolveAgentConfig: async () => ({
        tone: 'warm',
        emojiUse: 'light',
        responseLength: 'short',
        specialInstructions: null,
      }),
      callAI: async () => 'Welcome to Palmera Villa, Alice!',
    };

    const result = await generateJourneyMessage(baseInput, deps);

    assert.ok(result !== null);
    assert.equal(result.suggestion, 'Welcome to Palmera Villa, Alice!');
    assert.ok(result.sourcesUsed.length > 0);
    assert.ok(result.sourcesUsed.some((s) => s.id === 'k1'));
  });

  void it('returns null when AI fails', async () => {
    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: null,
        emojiUse: null,
        responseLength: null,
        specialInstructions: null,
      }),
      callAI: async () => null,
    };

    const result = await generateJourneyMessage(baseInput, deps);
    assert.equal(result, null);
  });

  void it('includes directive in system prompt', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];

    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: null,
        emojiUse: null,
        responseLength: null,
        specialInstructions: null,
      }),
      callAI: async (messages) => {
        capturedMessages = messages;
        return 'Hello guest!';
      },
    };

    const directive = 'Remind the guest about the check-in procedure';
    await generateJourneyMessage({ ...baseInput, directive }, deps);

    const systemMessage = capturedMessages.find((m) => m.role === 'system');
    assert.ok(systemMessage, 'System message should be present');
    assert.ok(
      systemMessage.content.includes(directive),
      `System prompt should contain directive "${directive}"`,
    );
  });

  void it('correctly determines booking phase: pre-arrival', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];

    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: null,
        emojiUse: null,
        responseLength: null,
        specialInstructions: null,
      }),
      callAI: async (messages) => {
        capturedMessages = messages;
        return 'msg';
      },
    };

    // checkIn is far in the future
    const futureCheckIn = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const futureCheckOut = new Date(Date.now() + 17 * 24 * 60 * 60 * 1000);
    await generateJourneyMessage(
      { ...baseInput, checkIn: futureCheckIn, checkOut: futureCheckOut },
      deps,
    );

    const systemMessage = capturedMessages.find((m) => m.role === 'system');
    assert.ok(systemMessage);
    assert.ok(
      systemMessage.content.includes('pre-arrival'),
      'Should detect pre-arrival phase',
    );
  });

  void it('correctly determines booking phase: during-stay', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];

    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: null,
        emojiUse: null,
        responseLength: null,
        specialInstructions: null,
      }),
      callAI: async (messages) => {
        capturedMessages = messages;
        return 'msg';
      },
    };

    // checkIn is yesterday, checkOut is tomorrow
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await generateJourneyMessage(
      { ...baseInput, checkIn: yesterday, checkOut: tomorrow },
      deps,
    );

    const systemMessage = capturedMessages.find((m) => m.role === 'system');
    assert.ok(systemMessage);
    assert.ok(
      systemMessage.content.includes('currently hosting'),
      'Should detect during-stay phase',
    );
  });

  void it('correctly determines booking phase: post-checkout', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];

    const deps: GenerateJourneyMessageDeps = {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: null,
        emojiUse: null,
        responseLength: null,
        specialInstructions: null,
      }),
      callAI: async (messages) => {
        capturedMessages = messages;
        return 'msg';
      },
    };

    // Both checkIn and checkOut are in the past
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    await generateJourneyMessage(
      { ...baseInput, checkIn: twoDaysAgo, checkOut: oneDayAgo },
      deps,
    );

    const systemMessage = capturedMessages.find((m) => m.role === 'system');
    assert.ok(systemMessage);
    assert.ok(
      systemMessage.content.includes('post-checkout'),
      'Should detect post-checkout phase',
    );
  });
});
