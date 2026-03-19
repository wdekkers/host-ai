import { organizationMemberships } from '@walt/db';
import { eq, and } from 'drizzle-orm';

export type OwnerContact = {
  email: string | null;
  phone: string | null;
};

export async function resolveOwnerContact(orgId: string): Promise<OwnerContact> {
  const { db } = await import('@/lib/db');

  const [membership] = await db
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.role, 'owner'),
      ),
    )
    .limit(1);

  if (!membership) return { email: null, phone: null };

  const clerkRes = await fetch(
    `https://api.clerk.com/v1/users/${membership.userId}`,
    { headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } },
  );

  if (!clerkRes.ok) return { email: null, phone: null };

  const user = (await clerkRes.json()) as {
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string;
    phone_numbers: Array<{ phone_number: string }>;
  };

  const primaryEmail = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id,
  );

  return {
    email: primaryEmail?.email_address ?? null,
    phone: user.phone_numbers[0]?.phone_number ?? null,
  };
}
