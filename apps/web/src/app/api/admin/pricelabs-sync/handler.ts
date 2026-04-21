import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/auth/resolve-actor';
import { handleCronSync } from '../../cron/pricelabs-sync/handler';

export async function handleAdminSync(request: Request): Promise<Response> {
  const actorOrRes = await resolveActor(request, 'integrations.read');
  if (actorOrRes instanceof Response) return actorOrRes;
  if (actorOrRes.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cronReq = new Request(request.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return handleCronSync(cronReq);
}
