import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { riskSignalsCatalog } from '@walt/db';

export type DefaultSignal = {
  label: string;
  dimension: 'booking_pattern' | 'profile' | 'language' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  valence: 'risk' | 'trust' | 'neutral';
};

export const DEFAULT_RISK_SIGNALS: DefaultSignal[] = [
  { label: 'Extra guests beyond stated count', dimension: 'policy_violation', severity: 'medium', valence: 'risk' },
  { label: 'Party / event / gathering at the property', dimension: 'policy_violation', severity: 'high', valence: 'risk' },
  { label: 'Unregistered or external visitors', dimension: 'policy_violation', severity: 'high', valence: 'risk' },
  { label: 'House rules accepted in chat, then violated on stay', dimension: 'profile', severity: 'critical', valence: 'risk' },
  { label: 'House rules acceptance never confirmed in chat', dimension: 'policy_violation', severity: 'medium', valence: 'risk' },
  { label: 'Linens damaged or cleanliness incident on prior stay', dimension: 'profile', severity: 'high', valence: 'risk' },
  { label: 'Pet exception-seeking after no-pets stated', dimension: 'language', severity: 'medium', valence: 'risk' },
  { label: 'Same-day, weekend 1-night booking', dimension: 'booking_pattern', severity: 'low', valence: 'risk' },
  { label: 'Vague trip purpose', dimension: 'language', severity: 'low', valence: 'risk' },
  { label: 'Large group relative to property capacity', dimension: 'booking_pattern', severity: 'medium', valence: 'risk' },
  { label: 'Strong private-feedback history (no complaints across stays)', dimension: 'profile', severity: 'low', valence: 'trust' },
  { label: 'Explicit acceptance of house rules in chat', dimension: 'language', severity: 'low', valence: 'trust' },
  { label: 'Cooperative tone, transparent purpose', dimension: 'language', severity: 'low', valence: 'trust' },
];

/**
 * Seeds the default catalog rows for an org. Idempotent — uses ON CONFLICT
 * on (organization_id, label) so re-running is safe.
 */
export async function seedDefaultRiskSignals(organizationId: string): Promise<number> {
  const rows = DEFAULT_RISK_SIGNALS.map((s) => ({
    id: uuidv4(),
    organizationId,
    label: s.label,
    dimension: s.dimension,
    severity: s.severity,
    valence: s.valence,
    active: true,
    isDefault: true,
  }));

  const inserted = await db
    .insert(riskSignalsCatalog)
    .values(rows)
    .onConflictDoNothing({ target: [riskSignalsCatalog.organizationId, riskSignalsCatalog.label] })
    .returning({ id: riskSignalsCatalog.id });

  return inserted.length;
}
