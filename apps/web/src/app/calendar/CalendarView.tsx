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

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function formatMonth(d: Date) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatCents(cents: number, currency?: string | null) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: currency ?? 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (86400000));
}

const COLORS = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#be185d'];
const DIAG = 18;
const ROW_H = 55;
const COL_W = 70;
const PROP_W = 220;
const BAR_INSET = 4; // top/bottom inset for bars

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

  const todayStr = toDateStr(new Date());

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
            <div style={{ minWidth: PROP_W + daysInMonth * COL_W }}>
              {/* Header row */}
              <div className="flex border-b border-slate-200">
                <div
                  className="sticky left-0 z-20 bg-white border-r border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 shrink-0"
                  style={{ width: PROP_W, minWidth: PROP_W }}
                >
                  Property
                </div>
                {dayHeaders.map((d) => {
                  const isToday = toDateStr(d) === todayStr;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={d.getDate()}
                      className={`shrink-0 px-0 py-2 text-center text-xs font-normal border-r border-slate-100 ${
                        isToday ? 'bg-sky-50 text-sky-700 font-bold' : isWeekend ? 'bg-slate-50 text-slate-400' : 'text-slate-500'
                      }`}
                      style={{ width: COL_W, minWidth: COL_W }}
                    >
                      <div className="text-[11px]">{d.getDate()}</div>
                      <div className="text-[9px] uppercase">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
                    </div>
                  );
                })}
              </div>

              {/* Property rows */}
              {properties.map((prop) => {
                const propReservations = reservationsByProperty.get(prop.id) ?? [];

                return (
                  <div key={prop.id} className="flex relative" style={{ height: ROW_H }}>
                    {/* Property name — sticky */}
                    <div
                      className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-4 flex items-center text-xs font-medium text-slate-900 truncate shrink-0"
                      style={{ width: PROP_W, minWidth: PROP_W }}
                    >
                      {prop.name}
                    </div>

                    {/* Day grid cells (empty — just for grid lines) */}
                    {dayHeaders.map((d) => {
                      const isToday = toDateStr(d) === todayStr;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div
                          key={d.getDate()}
                          className={`shrink-0 border-b border-r border-slate-100 ${
                            isToday ? 'bg-sky-50' : isWeekend ? 'bg-slate-50/50' : ''
                          }`}
                          style={{ width: COL_W, minWidth: COL_W, height: ROW_H }}
                        />
                      );
                    })}

                    {/* Reservation bars — single continuous elements overlaid */}
                    {propReservations.map((r) => {
                      if (!r.arrivalDate || !r.departureDate) return null;

                      const arrival = new Date(r.arrivalDate);
                      const departure = new Date(r.departureDate);

                      // Calculate position relative to month start
                      const startDay = Math.max(0, daysBetween(monthStart, arrival));
                      // +1 so the bar extends INTO the checkout day (diagonal ends there)
                      const endDay = Math.min(daysInMonth, daysBetween(monthStart, departure) + 1);

                      if (endDay <= 0 || startDay >= daysInMonth) return null;

                      const left = PROP_W + startDay * COL_W;
                      const width = (endDay - startDay) * COL_W;
                      const color = reservationColor.get(r.id) ?? COLORS[0];
                      const guestName = [r.guestFirstName, r.guestLastName].filter(Boolean).join(' ');

                      // Clip-path: diagonal at start (/) and end (/)
                      const startsInView = startDay === daysBetween(monthStart, arrival);
                      const endsInView = endDay === daysBetween(monthStart, departure) + 1;
                      const leftDiag = startsInView ? DIAG : 0;
                      const rightDiag = endsInView ? DIAG : 0;

                      return (
                        <div
                          key={r.id}
                          className="absolute z-10 flex items-center cursor-pointer hover:brightness-110 transition-all"
                          style={{
                            left,
                            width,
                            top: BAR_INSET,
                            bottom: BAR_INSET,
                            backgroundColor: color,
                            clipPath: `polygon(${leftDiag}px 0, calc(100% - 0px) 0, calc(100% - ${rightDiag}px) 100%, 0px 100%)`,
                          }}
                          onClick={() => setSelectedReservation(r)}
                          title={`${guestName} · ${formatDate(r.arrivalDate)} – ${formatDate(r.departureDate)}`}
                        >
                          <span className="text-[11px] text-white font-medium truncate pl-5 pr-2">
                            {guestName}
                            {showRates && r.nightlyRate ? ` · ${formatCents(r.nightlyRate, r.currency)}/n` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservation popup */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedReservation(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
                {selectedReservation.status && <Badge variant="secondary">{selectedReservation.status}</Badge>}
                {selectedReservation.platform && <Badge variant="outline">{selectedReservation.platform}</Badge>}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedReservation(null)}>Close</Button>
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
