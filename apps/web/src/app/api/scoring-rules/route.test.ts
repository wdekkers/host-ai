import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCreateScoringRule, handleListScoringRules } from './handler';

type ScoringRuleRow = {
  id: string;
  organizationId: string;
  ruleText: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
};

void test('handleListScoringRules returns org rules', async () => {
  let receivedOrgId: string | undefined;
  const rows: ScoringRuleRow[] = [
    {
      id: 'rule-1',
      organizationId: 'org-1',
      ruleText: 'No pets ever.',
      active: true,
      createdAt: new Date('2026-04-20T12:00:00.000Z'),
      updatedAt: new Date('2026-04-20T12:00:00.000Z'),
      createdBy: 'user-1',
    },
    {
      id: 'rule-2',
      organizationId: 'org-1',
      ruleText: 'No parties.',
      active: true,
      createdAt: new Date('2026-04-19T12:00:00.000Z'),
      updatedAt: new Date('2026-04-19T12:00:00.000Z'),
      createdBy: 'user-1',
    },
  ];

  const response = await handleListScoringRules(
    { orgId: 'org-1' },
    {
      listRules: async (orgId) => {
        receivedOrgId = orgId;
        return rows;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedOrgId, 'org-1');
  const body = (await response.json()) as { items: ScoringRuleRow[] };
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0]?.id, 'rule-1');
  assert.equal(body.items[1]?.id, 'rule-2');
});

void test('handleCreateScoringRule rejects empty rule text', async () => {
  let createCalled = false;
  const response = await handleCreateScoringRule(
    new Request('http://localhost/api/scoring-rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ruleText: '   ' }),
    }),
    { orgId: 'org-1', userId: 'user-1' },
    {
      createRule: async () => {
        createCalled = true;
        throw new Error('should not be called');
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(createCalled, false);
});

void test('handleCreateScoringRule inserts and returns the new rule', async () => {
  let receivedArgs: { orgId: string; userId: string; ruleText: string } | undefined;
  const response = await handleCreateScoringRule(
    new Request('http://localhost/api/scoring-rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ruleText: 'No unregistered visitors.' }),
    }),
    { orgId: 'org-1', userId: 'user-1' },
    {
      createRule: async (args) => {
        receivedArgs = args;
        return {
          id: 'rule-new',
          organizationId: args.orgId,
          ruleText: args.ruleText,
          active: true,
          createdAt: new Date('2026-04-21T00:00:00.000Z'),
          updatedAt: new Date('2026-04-21T00:00:00.000Z'),
          createdBy: args.userId,
        } satisfies ScoringRuleRow;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(receivedArgs, {
    orgId: 'org-1',
    userId: 'user-1',
    ruleText: 'No unregistered visitors.',
  });
  const body = (await response.json()) as { item: ScoringRuleRow };
  assert.equal(body.item.id, 'rule-new');
  assert.equal(body.item.ruleText, 'No unregistered visitors.');
});
