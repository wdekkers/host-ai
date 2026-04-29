import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { riskSignalsCatalog, propertySignalOverrides } from '@walt/db';

export type Dimension = 'booking_pattern' | 'profile' | 'language' | 'policy_violation';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Valence = 'risk' | 'trust' | 'neutral';

export type CatalogRow = {
  id: string;
  label: string;
  dimension: Dimension;
  severity: Severity;
  valence: Valence;
  active: boolean;
};

export type OverrideRow = {
  catalogItemId: string;
  severity: Severity | null;
  active: boolean | null;
};

export type EffectiveSignal = Omit<CatalogRow, 'active'>;

export function applyOverrides(
  catalog: CatalogRow[],
  overrides: OverrideRow[],
): EffectiveSignal[] {
  const overrideMap = new Map(overrides.map((o) => [o.catalogItemId, o]));
  const result: EffectiveSignal[] = [];
  for (const row of catalog) {
    const override = overrideMap.get(row.id);
    const effectiveActive = override?.active ?? row.active;
    if (!effectiveActive) continue;
    result.push({
      id: row.id,
      label: row.label,
      dimension: row.dimension,
      severity: override?.severity ?? row.severity,
      valence: row.valence,
    });
  }
  return result;
}

export async function loadEffectiveCatalog(
  organizationId: string,
  propertyId: string | null,
): Promise<EffectiveSignal[]> {
  const catalogRows = await db
    .select({
      id: riskSignalsCatalog.id,
      label: riskSignalsCatalog.label,
      dimension: riskSignalsCatalog.dimension,
      severity: riskSignalsCatalog.severity,
      valence: riskSignalsCatalog.valence,
      active: riskSignalsCatalog.active,
    })
    .from(riskSignalsCatalog)
    .where(eq(riskSignalsCatalog.organizationId, organizationId));

  let overrides: OverrideRow[] = [];
  if (propertyId) {
    const rows = await db
      .select({
        catalogItemId: propertySignalOverrides.catalogItemId,
        severity: propertySignalOverrides.severity,
        active: propertySignalOverrides.active,
      })
      .from(propertySignalOverrides)
      .where(eq(propertySignalOverrides.propertyId, propertyId));
    overrides = rows.map((r) => ({
      catalogItemId: r.catalogItemId,
      severity: r.severity as Severity | null,
      active: r.active,
    }));
  }

  return applyOverrides(catalogRows as CatalogRow[], overrides as OverrideRow[]);
}
