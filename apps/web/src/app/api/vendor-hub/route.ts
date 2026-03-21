import { desc, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { vendors, smsMessageLogs } from '@walt/db';

export const GET = withPermission('contacts.read', async () => {
  // Get all vendors with their latest message
  const rows = await db
    .select({
      id: vendors.id,
      companyName: vendors.companyName,
      contactName: vendors.contactName,
      phoneE164: vendors.phoneE164,
      status: vendors.status,
      lastMessageBody: sql<string | null>`(
        SELECT ${smsMessageLogs.body}
        FROM ${smsMessageLogs}
        WHERE ${smsMessageLogs.vendorId} = ${vendors.id}
        ORDER BY ${smsMessageLogs.createdAt} DESC
        LIMIT 1
      )`.as('last_message_body'),
      lastMessageAt: sql<string | null>`(
        SELECT ${smsMessageLogs.createdAt}::text
        FROM ${smsMessageLogs}
        WHERE ${smsMessageLogs.vendorId} = ${vendors.id}
        ORDER BY ${smsMessageLogs.createdAt} DESC
        LIMIT 1
      )`.as('last_message_at'),
    })
    .from(vendors)
    .orderBy(desc(sql`(
      SELECT ${smsMessageLogs.createdAt}
      FROM ${smsMessageLogs}
      WHERE ${smsMessageLogs.vendorId} = ${vendors.id}
      ORDER BY ${smsMessageLogs.createdAt} DESC
      LIMIT 1
    )`));

  return NextResponse.json({ vendors: rows });
});
