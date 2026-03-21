'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Property = { id: string; name: string };
type Reservation = {
  id: string;
  propertyId: string;
  guestFirstName: string | null;
  guestLastName: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  status: string | null;
  platform: string | null;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function formatMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarView() {
  const { getToken } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const daysInMonth = useMemo(() => monthEnd.getDate(), [monthEnd]);

  const dayHeaders = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
    }
    return days;
  }, [monthStart, daysInMonth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const start = toDateStr(monthStart);
    const end = toDateStr(monthEnd);

    const res = await fetch(`/api/calendar?start=${start}&end=${end}`, { headers });
    if (res.ok) {
      const data = (await res.json()) as { properties: Property[]; reservations: Reservation[] };
      setProperties(data.properties);
      setReservations(data.reservations);
    }
    setLoading(false);
  }, [getToken, monthStart, monthEnd]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Group reservations by property
  const reservationsByProperty = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (!r.propertyId) continue;
      const list = map.get(r.propertyId) ?? [];
      list.push(r);
      map.set(r.propertyId, list);
    }
    return map;
  }, [reservations]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">
            {formatMonth(currentMonth)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-400">Loading...</CardContent></Card>
      ) : properties.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-400">No active properties found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500 w-[160px] min-w-[160px]">
                    Property
                  </th>
                  {dayHeaders.map((d) => {
                    const isToday = toDateStr(d) === toDateStr(new Date());
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th
                        key={d.getDate()}
                        className={`border-b border-slate-200 px-0.5 py-2 text-center text-xs font-normal w-[32px] min-w-[32px] ${
                          isToday ? 'bg-sky-50 text-sky-700 font-bold' : isWeekend ? 'bg-slate-50 text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        <div>{d.getDate()}</div>
                        <div className="text-[9px]">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {properties.map((prop) => {
                  const propReservations = reservationsByProperty.get(prop.id) ?? [];
                  return (
                    <tr key={prop.id} className="group">
                      <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 truncate max-w-[160px]">
                        {prop.name}
                      </td>
                      {dayHeaders.map((d) => {
                        const dateStr = toDateStr(d);
                        const isToday = dateStr === toDateStr(new Date());
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                        // Find reservation that covers this day
                        const active = propReservations.find((r) => {
                          if (!r.arrivalDate || !r.departureDate) return false;
                          const arrival = toDateStr(new Date(r.arrivalDate));
                          const departure = toDateStr(new Date(r.departureDate));
                          return dateStr >= arrival && dateStr < departure;
                        });

                        // Check for turnover: checkout today AND checkin today
                        const hasCheckout = propReservations.some(
                          (r) => r.departureDate && toDateStr(new Date(r.departureDate)) === dateStr,
                        );
                        const hasCheckin = propReservations.some(
                          (r) => r.arrivalDate && toDateStr(new Date(r.arrivalDate)) === dateStr,
                        );
                        const isTurnover = hasCheckout && hasCheckin;

                        const isArrival = active && active.arrivalDate && toDateStr(new Date(active.arrivalDate)) === dateStr;
                        const guestName = active
                          ? [active.guestFirstName, active.guestLastName?.charAt(0)].filter(Boolean).join(' ')
                          : '';

                        return (
                          <td
                            key={d.getDate()}
                            className={`border-b border-slate-100 px-0 py-1 text-center relative ${
                              isToday ? 'bg-sky-50' : isWeekend ? 'bg-slate-50/50' : ''
                            }`}
                            title={
                              active
                                ? `${guestName} · ${active.arrivalDate ? new Date(active.arrivalDate).toLocaleDateString() : ''} – ${active.departureDate ? new Date(active.departureDate).toLocaleDateString() : ''}`
                                : undefined
                            }
                          >
                            {active && (
                              <div
                                className={`h-5 text-[9px] leading-5 text-white truncate ${
                                  isArrival ? 'rounded-l-sm ml-0.5' : ''
                                }`}
                                style={{ backgroundColor: '#0284c7' }}
                              >
                                {isArrival ? guestName : ''}
                              </div>
                            )}
                            {isTurnover && !active && (
                              <div className="h-5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Turnover" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
