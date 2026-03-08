import { authContextSchema, roleSchema } from '@walt/contracts';

import type { AuthContext } from '@walt/contracts';

function getTestAuthContextFromHeaders(request?: Request): AuthContext {
  const userId = request?.headers.get('x-test-auth-user-id') ?? 'test-user';
  const orgId = request?.headers.get('x-test-auth-org-id') ?? 'test-org';
  const role = request?.headers.get('x-test-auth-role') ?? 'owner';
  const propertyIdsHeader = request?.headers.get('x-test-auth-property-ids') ?? '';
  const propertyIds = propertyIdsHeader
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return authContextSchema.parse({
    userId,
    orgId,
    role,
    propertyIds: propertyIds.length > 0 ? propertyIds : undefined,
  });
}

export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  if (process.env.NODE_ENV === 'test') {
    return getTestAuthContextFromHeaders(request);
  }

  const clerkModule = await import('@clerk/nextjs/server').catch(() => null);
  if (!clerkModule) {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    return getTestAuthContextFromHeaders(request);
  }

  const session = await clerkModule.auth();
  if (!session.userId || !session.orgId) {
    return null;
  }

  const client = await clerkModule.clerkClient();
  const user = await client.users.getUser(session.userId);
  const roleCandidate = (user.privateMetadata as Record<string, unknown>).role;
  const parsed = roleSchema.safeParse(roleCandidate);
  const role = parsed.success ? parsed.data : 'viewer';

  return authContextSchema.parse({
    userId: session.userId,
    orgId: session.orgId,
    role,
    propertyIds: undefined,
  });
}
