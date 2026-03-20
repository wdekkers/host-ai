import assert from 'node:assert/strict';
import test from 'node:test';

import { navGroups } from './nav-links';

void test('navGroups has four groups', () => {
  assert.equal(navGroups.length, 4);
});

void test('first group is Overview with Today as first item', () => {
  const overview = navGroups[0];
  assert.equal(overview?.label, 'Overview');
  assert.equal(overview?.items[0]?.href, '/today');
  assert.equal(overview?.items[0]?.label, 'Today');
});

void test('Operations group contains Properties', () => {
  const ops = navGroups.find((g) => g.label === 'Operations');
  assert.ok(ops, 'Operations group exists');
  assert.ok(ops.items.some((i) => i.href === '/properties'));
});

void test('System group contains Settings and Admin', () => {
  const sys = navGroups.find((g) => g.label === 'System');
  assert.ok(sys, 'System group exists');
  assert.ok(sys.items.some((i) => i.href === '/settings'));
  assert.ok(sys.items.some((i) => i.href === '/admin/vendors'));
});

void test('all items have an icon', () => {
  for (const group of navGroups) {
    for (const item of group.items) {
      assert.ok(item.icon, `${item.label} has an icon`);
    }
  }
});
