import { and, eq, or, sql } from 'drizzle-orm';
import { reservations, propertyAccess, properties } from '@walt/db';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { SuggestionsStack } from './SuggestionsStack';
import { getPoolTemperatures } from './get-pool-temperatures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarCheck,
  CheckSquare,
  Thermometer,
} from 'lucide-react';

async function getTurnovers(orgId: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
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

  const checkoutsCount = turnovers.filter((t) => t.departureDate).length;
  const checkinsCount = turnovers.filter((t) => t.arrivalDate).length;

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">{dateLabel}</p>
      </div>

      <SuggestionsStack />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <CalendarCheck className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{checkoutsCount}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-outs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <CalendarCheck className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{checkinsCount}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-ins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <CheckSquare className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Tasks Due</div>
          </CardContent>
        </Card>
        {poolTemps.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Thermometer className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{poolTemps.length}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Pool Temps</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pool Temperatures */}
      {poolTemps.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Thermometer className="h-4 w-4 text-slate-400" />
              Pool Temperatures
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 overflow-x-auto px-4 pb-4">
            {poolTemps.map((pool) => (
              <div
                key={pool.propertyId}
                className="min-w-[140px] shrink-0 rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="truncate text-sm font-medium text-slate-900">{pool.propertyName}</div>
                <div className="mt-1 text-2xl font-bold text-sky-600">
                  {pool.temperatureF !== null ? `${pool.temperatureF}°F` : '—'}
                </div>
                {pool.asOf && (
                  <div className="mt-1 text-xs text-slate-400">
                    as of{' '}
                    {pool.asOf.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/Chicago',
                    })}
                  </div>
                )}
                {!pool.pumpRunning && (
                  <Badge variant="secondary" className="mt-2 text-xs">Pump off</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Turnovers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck className="h-4 w-4 text-slate-400" />
            Turnovers Today
          </CardTitle>
          <Badge variant="secondary">{turnovers.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {turnovers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No turnovers today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {turnovers.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t.propertyName}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.guestFirstName} {t.guestLastName}
                      {t.departureDate &&
                        ` · Out ${new Date(t.departureDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                      {t.arrivalDate &&
                        ` · In ${new Date(t.arrivalDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                    </div>
                  </div>
                  <Badge
                    variant={
                      t.arrivalDate && t.departureDate
                        ? 'secondary'
                        : t.arrivalDate
                          ? 'default'
                          : 'outline'
                    }
                  >
                    {t.arrivalDate && t.departureDate
                      ? 'Turnover'
                      : t.arrivalDate
                        ? 'Check-in'
                        : 'Check-out'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare className="h-4 w-4 text-slate-400" />
            Tasks Due Today
          </CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No tasks due today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(tasks as Array<{ id: string; title: string; priority: string }>).map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${task.priority === 'high' ? 'bg-red-500' : 'bg-slate-300'}`}
                  />
                  <span className="text-sm text-slate-900">{task.title}</span>
                  {task.priority === 'high' && (
                    <Badge variant="destructive" className="ml-auto text-xs">High</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
