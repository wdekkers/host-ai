import { desc, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { messages, reservations } from '@walt/db';

const PAGE_SIZE = 25;

// NOTE: `reservations` and `messages` tables do not have an organizationId column (pre-existing
// schema limitation). Auth is enforced at the Clerk session level — only authenticated users
// with a valid org token can reach this route. This is consistent with all other inbox routes.
// org-level data isolation in the DB is a future improvement.
export const handleGetInbox = withPermission('inbox.read', async (request: Request) => {
  try {
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') ?? 'all'; // 'all' | 'unreplied' | 'ai_ready' | 'escalated'
    const search = url.searchParams.get('search') ?? '';
    const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
    const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
    const rawPerPage = parseInt(url.searchParams.get('per_page') ?? String(PAGE_SIZE), 10);
    const perPage = Math.min(100, Math.max(1, Number.isNaN(rawPerPage) ? PAGE_SIZE : rawPerPage));
    const offset = (page - 1) * perPage;

    // Get all reservationIds ordered by most recent message, with per-thread stats
    const threadStats = await db
      .select({
        reservationId: messages.reservationId,
        lastMessageAt: sql<string>`max(${messages.createdAt})`.as('last_message_at'),
        lastBody:
          sql<string>`(array_agg(${messages.body} order by ${messages.createdAt} desc))[1]`.as(
            'last_body',
          ),
        lastSenderType:
          sql<string>`(array_agg(${messages.senderType} order by ${messages.createdAt} desc))[1]`.as(
            'last_sender_type',
          ),
      })
      .from(messages)
      .groupBy(messages.reservationId)
      .orderBy(desc(sql`max(${messages.createdAt})`));

    // Join with reservations for guest name / property name / search
    const reservationRows = await db
      .select({
        id: reservations.id,
        guestFirstName: reservations.guestFirstName,
        guestLastName: reservations.guestLastName,
        propertyId: reservations.propertyId,
        propertyName: reservations.propertyName,
        checkIn: reservations.checkIn,
        checkOut: reservations.checkOut,
        platform: reservations.platform,
        status: reservations.status,
        guestScore: reservations.guestScore,
        guestScoreSummary: reservations.guestScoreSummary,
      })
      .from(reservations)
      .where(
        inArray(
          reservations.id,
          threadStats.map((t) => t.reservationId),
        ),
      );

    const reservationMap = new Map(reservationRows.map((r) => [r.id, r]));

    // Determine unreplied: fetch most recent message per reservation
    const mostRecentMessages = await db
      .select({
        reservationId: messages.reservationId,
        senderType: messages.senderType,
        suggestion: messages.suggestion,
        id: messages.id,
        draftStatus: messages.draftStatus,
        intent: messages.intent,
        escalationLevel: messages.escalationLevel,
        escalationReason: messages.escalationReason,
      })
      .from(messages)
      .where(
        inArray(
          messages.reservationId,
          threadStats.map((t) => t.reservationId),
        ),
      )
      .orderBy(desc(messages.createdAt));

    const latestByReservation = new Map<
      string,
      {
        senderType: string;
        suggestion: string | null;
        id: string;
        draftStatus: string | null;
        intent: string | null;
        escalationLevel: string | null;
        escalationReason: string | null;
      }
    >();
    for (const m of mostRecentMessages) {
      // Skip system messages for unreplied/aiReady detection
      if (m.senderType === 'system') continue;
      if (!latestByReservation.has(m.reservationId)) {
        latestByReservation.set(m.reservationId, {
          senderType: m.senderType,
          suggestion: m.suggestion,
          id: m.id,
          draftStatus: m.draftStatus,
          intent: m.intent,
          escalationLevel: m.escalationLevel,
          escalationReason: m.escalationReason,
        });
      }
    }

    // Build thread list
    let threads = threadStats.map((t) => {
      const res = reservationMap.get(t.reservationId);
      const latest = latestByReservation.get(t.reservationId);
      const unreplied = latest?.senderType === 'guest';
      const aiReady = unreplied && latest?.suggestion != null;
      const guestName =
        [res?.guestFirstName, res?.guestLastName].filter(Boolean).join(' ') || 'Guest';
      return {
        reservationId: t.reservationId,
        guestName,
        propertyId: res?.propertyId ?? null,
        propertyName: res?.propertyName ?? null,
        checkIn: res?.checkIn ?? null,
        checkOut: res?.checkOut ?? null,
        platform: res?.platform ?? null,
        status: res?.status ?? null,
        guestScore: res?.guestScore ?? null,
        guestScoreSummary: res?.guestScoreSummary ?? null,
        lastBody: t.lastBody,
        lastSenderType: t.lastSenderType,
        lastMessageAt: t.lastMessageAt,
        unreplied,
        aiReady,
        latestMessageId: latest?.id ?? null,
        latestSuggestion: latest?.suggestion ?? null,
        draftStatus: latest?.draftStatus ?? null,
        intent: latest?.intent ?? null,
        escalationLevel: latest?.escalationLevel ?? null,
        escalationReason: latest?.escalationReason ?? null,
      };
    });

    // Sort: most recent activity first (chronological)
    threads.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    // Filter
    if (filter === 'unreplied') threads = threads.filter((t) => t.unreplied);
    if (filter === 'ai_ready') threads = threads.filter((t) => t.aiReady);
    if (filter === 'escalated')
      threads = threads.filter(
        (t) => t.escalationLevel === 'caution' || t.escalationLevel === 'escalate',
      );

    // Search
    if (search) {
      const q = search.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.guestName.toLowerCase().includes(q) || (t.propertyName ?? '').toLowerCase().includes(q),
      );
    }

    const total = threads.length;
    const paged = threads.slice(offset, offset + perPage);

    return NextResponse.json({ threads: paged, total, page, perPage });
  } catch (error) {
    return handleApiError({ error, route: '/api/inbox' });
  }
});
