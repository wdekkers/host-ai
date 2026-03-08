import assert from 'node:assert/strict';
import test from 'node:test';

import { navLinks } from './nav-links';

void test('includes Contact Center in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/contact-center' && link.label === 'Contact Center'), true);
});
