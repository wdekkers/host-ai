import assert from 'node:assert/strict';
import test from 'node:test';

import { navLinks } from './nav-links';

void test('includes Contacts in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/contacts' && link.label === 'Contacts'), true);
});

void test('includes Property Checklists in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/property-checklists' && link.label === 'Property Checklists'), true);
});
