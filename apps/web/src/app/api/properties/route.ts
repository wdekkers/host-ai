import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';

export async function GET() {
  try {
    const items = await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .orderBy(asc(properties.name));

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties' });
  }
}
