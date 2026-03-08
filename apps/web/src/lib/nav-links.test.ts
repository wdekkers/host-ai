import assert from 'node:assert/strict';
import test from 'node:test';

import { navLinks } from './nav-links';

void test('includes Contact Center in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/contact-center' && link.label === 'Contact Center'), true);
});

void test('includes Property Checklists in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/property-checklists' && link.label === 'Property Checklists'), true);
});
