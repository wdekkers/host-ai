import { and, eq, or, sql } from 'drizzle-orm';
import { reservations, propertyAccess, properties } from '@walt/db';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { SuggestionsStack } from './SuggestionsStack';
import { getPoolTemperatures } from './get-pool-temperatures';

async function getTurnovers(orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: reservations.id,
      propertyName: properties.name,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName,
      arrivalDate: reservations.arrivalDate,
      departureDate: reservations.departureDate,
    })
    .from(reservations)
    .innerJoin(
      propertyAccess,
      sql`${propertyAccess.propertyId} = ${reservations.propertyId}`,
    )
    .innerJoin(properties, eq(properties.id, propertyAccess.propertyId))
    .where(
      and(
        eq(propertyAccess.organizationId, orgId),
        or(
          sql`${reservations.arrivalDate}::date = ${today}::date`,
          sql`${reservations.departureDate}::date = ${today}::date`,
        ),
      ),
    )
    .orderBy(reservations.arrivalDate);
}

async function getTasksFromGateway(orgId: string) {
  const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';
  const headers = {
    accept: 'application/json',
    // Note: confirm gateway accepts CRON_SECRET as a service token.
    // If not, replace with Clerk getToken() from @clerk/nextjs/server.
    authorization: `Bearer ${process.env.CRON_SECRET}`,
  };

  const [dueRes, urgentRes] = await Promise.allSettled([
    fetch(`${gatewayBaseUrl}/tasks?organization_id=${orgId}&due_date=today`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${gatewayBaseUrl}/tasks?organization_id=${orgId}&priority=high&status=open`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  const tasks: unknown[] = [];
  if (dueRes.status === 'fulfilled' && dueRes.value.ok) {
    const body = (await dueRes.value.json()) as { tasks?: unknown[] };
    tasks.push(...(body.tasks ?? []));
  }
  if (urgentRes.status === 'fulfilled' && urgentRes.value.ok) {
    const body = (await urgentRes.value.json()) as { tasks?: unknown[] };
    tasks.push(...(body.tasks ?? []));
  }
  // Deduplicate by id
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const id = (t as { id: string }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default async function TodayPage() {
  const auth = await getAuthContext();
  if (!auth) return null;

  const [turnovers, tasks, poolTemps] = await Promise.all([
    getTurnovers(auth.orgId),
    getTasksFromGateway(auth.orgId),
    getPoolTemperatures(auth.orgId),
  ]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Today &middot; {dateLabel}</h1>

      <SuggestionsStack />

      <div className="flex gap-3">
        <a href="#turnovers" className="flex-1 rounded-lg bg-yellow-50 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{turnovers.length}</div>
          <div className="text-xs text-yellow-600">Turnovers</div>
        </a>
        <a href="#tasks" className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{tasks.length}</div>
          <div className="text-xs text-blue-600">Tasks Due</div>
        </a>
      </div>

      {poolTemps.length > 0 && (
        <section id="pool-temperatures">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Pool Temperatures
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {poolTemps.map((pool) => (
              <div
                key={pool.propertyId}
                className="rounded-lg border border-gray-200 bg-white p-4 min-w-[160px] shrink-0"
              >
                <div className="text-sm font-medium text-gray-900 truncate">{pool.propertyName}</div>
                <div className="text-2xl font-bold text-blue-700 mt-1">
                  {pool.temperatureF !== null ? `${pool.temperatureF}°F` : '—'}
                </div>
                {pool.asOf && (
                  <div className="text-xs text-gray-400 mt-1">
                    as of{' '}
                    {pool.asOf.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/Chicago',
                    })}
                  </div>
                )}
                {!pool.pumpRunning && (
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    Pump off
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="turnovers">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Turnovers Today
        </h2>
        {turnovers.length === 0 ? (
          <p className="text-sm text-gray-400">No turnovers today.</p>
        ) : (
          <div className="space-y-2">
            {turnovers.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{t.propertyName}</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">
                    {t.arrivalDate && t.departureDate
                      ? 'Turnover'
                      : t.arrivalDate
                        ? 'Check-in'
                        : 'Check-out'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {t.guestFirstName} {t.guestLastName}
                  {t.departureDate &&
                    ` · Out ${new Date(t.departureDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                  {t.arrivalDate &&
                    ` · In ${new Date(t.arrivalDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="tasks">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Tasks Due Today
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks due today.</p>
        ) : (
          <div className="space-y-2">
            {(tasks as Array<{ id: string; title: string; priority: string }>).map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-gray-200 bg-white p-4 flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-red-500' : 'bg-gray-300'}`}
                />
                <span className="text-sm text-gray-900">{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
