import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const conditions = includeInactive ? [] : [eq(properties.isActive, true)];

    const items = await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(properties.name));

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties' });
  }
}
