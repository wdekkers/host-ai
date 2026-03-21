import assert from 'node:assert/strict';
import test from 'node:test';

import { getPermissionForApiRoute, hasPermission } from './permissions';

void test('viewer can only read today', () => {
  assert.equal(hasPermission('viewer', 'today.read'), true);
  assert.equal(hasPermission('viewer', 'inbox.read'), false);
  assert.equal(hasPermission('viewer', 'tasks.read'), false);
});

void test('cleaner can read checklists and update but not create or delete', () => {
  assert.equal(hasPermission('cleaner', 'today.read'), true);
  assert.equal(hasPermission('cleaner', 'checklists.read'), true);
  assert.equal(hasPermission('cleaner', 'checklists.update'), true);
  assert.equal(hasPermission('cleaner', 'checklists.create'), false);
  assert.equal(hasPermission('cleaner', 'checklists.delete'), false);
  assert.equal(hasPermission('cleaner', 'inbox.read'), false);
});

void test('agent has inbox, tasks, checklists CRUD, contacts, no seo/settings/admin', () => {
  assert.equal(hasPermission('agent', 'inbox.read'), true);
  assert.equal(hasPermission('agent', 'inbox.create'), true);
  assert.equal(hasPermission('agent', 'tasks.create'), true);
  assert.equal(hasPermission('agent', 'checklists.delete'), true);
  assert.equal(hasPermission('agent', 'contacts.read'), true);
  assert.equal(hasPermission('agent', 'seo.read'), false);
  assert.equal(hasPermission('agent', 'settings.read'), false);
  assert.equal(hasPermission('agent', 'admin.read'), false);
});

void test('manager has everything except admin write', () => {
  assert.equal(hasPermission('manager', 'seo.create'), true);
  assert.equal(hasPermission('manager', 'settings.update'), true);
  assert.equal(hasPermission('manager', 'admin.read'), false);
  assert.equal(hasPermission('manager', 'admin.create'), false);
});

void test('owner has everything', () => {
  assert.equal(hasPermission('owner', 'admin.delete'), true);
  assert.equal(hasPermission('owner', 'settings.update'), true);
  assert.equal(hasPermission('owner', 'checklists.delete'), true);
});

void test('maps route + method to CRUD permission', () => {
  // SEO
  assert.equal(getPermissionForApiRoute('/api/command-center/seo-drafts', 'GET'), 'seo.read');
  assert.equal(getPermissionForApiRoute('/api/command-center/seo-drafts/run', 'POST'), 'seo.create');
  assert.equal(getPermissionForApiRoute('/api/command-center/seo-drafts/draft-1', 'PATCH'), 'seo.update');

  // Q&A
  assert.equal(getPermissionForApiRoute('/api/command-center/qa/property:abc', 'POST'), 'questions.update');
  assert.equal(getPermissionForApiRoute('/api/command-center/qa-suggestions/sug-1/approve', 'POST'), 'questions.update');

  // Inbox
  assert.equal(getPermissionForApiRoute('/api/inbox', 'GET'), 'inbox.read');
  assert.equal(getPermissionForApiRoute('/api/inbox/res-1/send', 'POST'), 'inbox.create');

  // Tasks
  assert.equal(getPermissionForApiRoute('/api/tasks', 'GET'), 'tasks.read');
  assert.equal(getPermissionForApiRoute('/api/tasks', 'POST'), 'tasks.create');
  assert.equal(getPermissionForApiRoute('/api/tasks/123', 'PATCH'), 'tasks.update');
  assert.equal(getPermissionForApiRoute('/api/tasks/123', 'DELETE'), 'tasks.delete');

  // Checklists
  assert.equal(getPermissionForApiRoute('/api/property-checklists/executions', 'GET'), 'checklists.read');
  assert.equal(getPermissionForApiRoute('/api/property-checklists/executions', 'POST'), 'checklists.create');

  // Admin
  assert.equal(getPermissionForApiRoute('/api/admin/vendors', 'GET'), 'admin.read');
  assert.equal(getPermissionForApiRoute('/api/admin/vendors/123/disable', 'PATCH'), 'admin.update');

  // Public
  assert.equal(getPermissionForApiRoute('/api/integrations/hospitable', 'POST'), null);
});
