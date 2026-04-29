import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOverrides, type CatalogRow, type OverrideRow } from './risk-signals-catalog';

const base: CatalogRow[] = [
  { id: 'a', label: 'Party', dimension: 'policy_violation', severity: 'high', valence: 'risk', active: true },
  { id: 'b', label: 'Extra guests', dimension: 'policy_violation', severity: 'medium', valence: 'risk', active: true },
  { id: 'c', label: 'Inactive', dimension: 'profile', severity: 'low', valence: 'risk', active: false },
];

void test('returns only active rows when there are no overrides', () => {
  const result = applyOverrides(base, []);
  assert.deepEqual(result.map((r) => r.id), ['a', 'b']);
});

void test('overrides severity when override severity is set', () => {
  const overrides: OverrideRow[] = [
    { catalogItemId: 'a', severity: 'low', active: null },
  ];
  const result = applyOverrides(base, overrides);
  const a = result.find((r) => r.id === 'a');
  assert.equal(a?.severity, 'low');
});

void test('omits a row when override active=false', () => {
  const overrides: OverrideRow[] = [
    { catalogItemId: 'a', severity: null, active: false },
  ];
  const result = applyOverrides(base, overrides);
  assert.equal(result.find((r) => r.id === 'a'), undefined);
});

void test('keeps a row when override active=true even if base active=false', () => {
  const overrides: OverrideRow[] = [
    { catalogItemId: 'c', severity: null, active: true },
  ];
  const result = applyOverrides(base, overrides);
  assert.notEqual(result.find((r) => r.id === 'c'), undefined);
});

void test('null override severity preserves base severity', () => {
  const overrides: OverrideRow[] = [
    { catalogItemId: 'b', severity: null, active: null },
  ];
  const result = applyOverrides(base, overrides);
  const b = result.find((r) => r.id === 'b');
  assert.equal(b?.severity, 'medium');
});
