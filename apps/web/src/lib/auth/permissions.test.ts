import assert from 'node:assert/strict';
import test from 'node:test';

import { getPermissionForApiRoute, hasPermission, resolveRoleFromClaims } from './permissions';

void test('viewer can only read dashboard', () => {
  assert.equal(hasPermission('viewer', 'dashboard.read'), true);
  assert.equal(hasPermission('viewer', 'drafts.write'), false);
});

void test('manager can execute automation but cannot configure platform', () => {
  assert.equal(hasPermission('manager', 'automation.execute'), true);
  assert.equal(hasPermission('manager', 'platform.configure'), false);
});

void test('maps route + method to permission', () => {
  assert.equal(getPermissionForApiRoute('/api/command-center/queue', 'GET'), 'dashboard.read');
  assert.equal(getPermissionForApiRoute('/api/command-center/queue/123', 'PATCH'), 'drafts.write');
  assert.equal(getPermissionForApiRoute('/api/command-center/autopilot/rollback', 'POST'), 'automation.execute');
  assert.equal(getPermissionForApiRoute('/api/integrations/hospitable', 'POST'), null);
});

void test('resolves role from claims fallback to viewer', () => {
  assert.equal(resolveRoleFromClaims({ metadata: { role: 'owner' } }), 'owner');
  assert.equal(resolveRoleFromClaims({ org_role: 'manager' }), 'manager');
  assert.equal(resolveRoleFromClaims({ metadata: { role: 'not-a-role' } }), 'viewer');
});
