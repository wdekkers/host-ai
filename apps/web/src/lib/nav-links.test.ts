import assert from 'node:assert/strict';
import test from 'node:test';

import { navLinks } from './nav-links';

void test('Today is the first nav item', () => {
  assert.equal(navLinks[0]?.href, '/today');
  assert.equal(navLinks[0]?.label, 'Today');
});

void test('includes Contacts in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/contacts' && link.label === 'Contacts'), true);
});

void test('includes Property Checklists in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/property-checklists' && link.label === 'Property Checklists'), true);
});

void test('includes Agent Settings in primary navigation', () => {
  assert.equal(
    navLinks.some((link) => link.href === '/settings/agent' && link.label === 'Agent Settings'),
    true,
  );
});

void test('includes SEO Drafts in primary navigation', () => {
  assert.equal(navLinks.some((link) => link.href === '/seo-drafts' && link.label === 'SEO Drafts'), true);
});
