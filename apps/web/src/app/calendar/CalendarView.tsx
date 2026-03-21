'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  totalPrice: number | null;
  nightlyRate: number | null;
  currency: string | null;
  nights: number | null;
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
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatCents(cents: number, currency?: string | null) {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const COLORS = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#be185d'];
const DIAG = 18;
const ROW_H = 55;
const COL_W = 70;

export function CalendarView({ showRates = false }: { showRates?: boolean }) {
  const { getToken } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

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

  useEffect(() => { void fetchData(); }, [fetchData]);

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

  // Assign a color per reservation for visual distinction
  const reservationColor = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const r of reservations) {
      map.set(r.id, COLORS[idx % COLORS.length]!);
      idx++;
    }
    return map;
  }, [reservations]);

  const selectedProperty = selectedReservation
    ? properties.find((p) => p.id === selectedReservation.propertyId)
    : null;

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
            <table className="border-collapse" style={{ minWidth: `${200 + daysInMonth * COL_W}px` }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-4 py-2 text-left text-xs font-medium text-slate-500" style={{ width: 200, minWidth: 200 }}>
                    Property
                  </th>
                  {dayHeaders.map((d) => {
                    const isToday = toDateStr(d) === toDateStr(new Date());
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th
                        key={d.getDate()}
                        className={`border-b border-r border-slate-100 px-0 py-2 text-center text-xs font-normal ${
                          isToday ? 'bg-sky-50 text-sky-700 font-bold' : isWeekend ? 'bg-slate-50 text-slate-400' : 'text-slate-500'
                        }`}
                        style={{ width: COL_W, minWidth: COL_W }}
                      >
                        <div className="text-[11px]">{d.getDate()}</div>
                        <div className="text-[9px] uppercase">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {properties.map((prop) => {
                  const propReservations = reservationsByProperty.get(prop.id) ?? [];
                  return (
                    <tr key={prop.id}>
                      <td className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-4 text-xs font-medium text-slate-900 truncate" style={{ height: ROW_H, width: 200, minWidth: 200 }}>
                        {prop.name}
                      </td>
                      {dayHeaders.map((d) => {
                        const dateStr = toDateStr(d);
                        const isToday = dateStr === toDateStr(new Date());
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                        const occupying = propReservations.find((r) => {
                          if (!r.arrivalDate || !r.departureDate) return false;
                          return dateStr >= toDateStr(new Date(r.arrivalDate)) && dateStr < toDateStr(new Date(r.departureDate));
                        });

                        const departing = propReservations.find(
                          (r) => r.departureDate && toDateStr(new Date(r.departureDate)) === dateStr,
                        );

                        const isArrival = occupying?.arrivalDate && toDateStr(new Date(occupying.arrivalDate)) === dateStr;
                        const isDepartTomorrow = occupying?.departureDate && (() => {
                          const nextDay = new Date(d);
                          nextDay.setDate(nextDay.getDate() + 1);
                          return toDateStr(new Date(occupying.departureDate!)) === toDateStr(nextDay);
                        })();

                        const color = occupying ? reservationColor.get(occupying.id) : undefined;
                        const departColor = departing ? reservationColor.get(departing.id) : undefined;
                        const guestName = occupying
                          ? [occupying.guestFirstName, occupying.guestLastName?.charAt(0)].filter(Boolean).join(' ')
                          : '';

                        let clipPath: string | undefined;
                        if (isArrival && isDepartTomorrow) {
                          clipPath = `polygon(${DIAG}px 0, 100% 0, calc(100% - ${DIAG}px) 100%, 0 100%)`;
                        } else if (isArrival) {
                          clipPath = `polygon(${DIAG}px 0, 100% 0, 100% 100%, 0 100%)`;
                        } else if (isDepartTomorrow) {
                          clipPath = `polygon(0 0, 100% 0, calc(100% - ${DIAG}px) 100%, 0 100%)`;
                        }

                        return (
                          <td
                            key={d.getDate()}
                            className={`border-b border-r border-slate-100 p-0 relative overflow-hidden ${
                              isToday ? 'bg-sky-50' : isWeekend ? 'bg-slate-50/50' : ''
                            }`}
                            style={{ height: ROW_H, width: COL_W, minWidth: COL_W }}
                          >
                            {/* Departing bar: diagonal end */}
                            {departing && (!occupying || occupying.id !== departing.id) && (
                              <div
                                className="absolute top-0 left-0 bottom-0 cursor-pointer hover:brightness-110"
                                style={{
                                  width: '50%',
                                  backgroundColor: departColor,
                                  clipPath: `polygon(0 0, 100% 0, calc(100% - ${DIAG}px) 100%, 0 100%)`,
                                }}
                                onClick={() => setSelectedReservation(departing)}
                              />
                            )}

                            {/* Empty cell: show nightly rate for owners */}
                            {!occupying && !departing && showRates && (() => {
                              // Show rate from nearest reservation for this property
                              const nearest = propReservations.find((r) => r.nightlyRate);
                              return nearest?.nightlyRate ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[9px] text-slate-400">
                                    {formatCents(nearest.nightlyRate, nearest.currency)}
                                  </span>
                                </div>
                              ) : null;
                            })()}

                            {/* Occupying bar */}
                            {occupying && (
                              <div
                                className="absolute top-0 bottom-0 flex items-center cursor-pointer hover:brightness-110 transition-all"
                                style={{
                                  left: departing && departing.id !== occupying.id ? '50%' : 0,
                                  right: 0,
                                  backgroundColor: color,
                                  clipPath,
                                }}
                                onClick={() => setSelectedReservation(occupying)}
                              >
                                {isArrival ? (
                                  <span className="text-[10px] text-white font-medium truncate pl-4 pr-1">
                                    {guestName}
                                    {showRates && occupying.nightlyRate ? ` · ${formatCents(occupying.nightlyRate, occupying.currency)}/n` : ''}
                                  </span>
                                ) : showRates && occupying.nightlyRate ? (
                                  <span className="text-[9px] text-white/70 w-full text-center">
                                    {formatCents(occupying.nightlyRate, occupying.currency)}
                                  </span>
                                ) : null}
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

      {/* Reservation popup */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedReservation(null)}>
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Reservation Details</h2>
              <button onClick={() => setSelectedReservation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Guest</div>
                <div className="text-sm font-semibold text-slate-900">
                  {[selectedReservation.guestFirstName, selectedReservation.guestLastName].filter(Boolean).join(' ') || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Property</div>
                <div className="text-sm text-slate-900">{selectedProperty?.name ?? '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-in</div>
                  <div className="text-sm text-slate-900">
                    {selectedReservation.arrivalDate ? formatDate(selectedReservation.arrivalDate) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-out</div>
                  <div className="text-sm text-slate-900">
                    {selectedReservation.departureDate ? formatDate(selectedReservation.departureDate) : '—'}
                  </div>
                </div>
              </div>
              {(selectedReservation.nightlyRate || selectedReservation.totalPrice) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedReservation.nightlyRate && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Nightly Rate</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCents(selectedReservation.nightlyRate, selectedReservation.currency)}
                      </div>
                    </div>
                  )}
                  {selectedReservation.totalPrice && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCents(selectedReservation.totalPrice, selectedReservation.currency)}
                        {selectedReservation.nights ? ` (${selectedReservation.nights} nights)` : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                {selectedReservation.status && (
                  <Badge variant="secondary">{selectedReservation.status}</Badge>
                )}
                {selectedReservation.platform && (
                  <Badge variant="outline">{selectedReservation.platform}</Badge>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedReservation(null)}>
                Close
              </Button>
              <Link href={`/inbox?reservationId=${selectedReservation.id}`}>
                <Button size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View in Inbox
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
