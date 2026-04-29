import { properties } from '@walt/db';
import type { Db } from './index.js';

export type PropertyContextItem = {
  id: string;
  name: string;
  nicknames: string[];
};

export async function loadPropertyContext(db: Db): Promise<PropertyContextItem[]> {
  const rows = await db
    .select({ id: properties.id, name: properties.name, nicknames: properties.nicknames })
    .from(properties);
  return rows.map((r) => ({ id: r.id, name: r.name, nicknames: r.nicknames ?? [] }));
}
