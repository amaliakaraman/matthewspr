'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plane, Sun, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@matthewsreis/ui/button';
import { Input } from '@matthewsreis/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@matthewsreis/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@matthewsreis/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@matthewsreis/ui/tabs';
import { cn } from '@/lib/utils';
import { useBooking } from './BookingProvider';
import { GuestDrawer } from './GuestDrawer';
import {
  getConflicts,
  formatTime,
  type AvailabilityKind,
  type AvailabilityBlock,
  type Guest,
  type TravelRange
} from '@/lib/demo/booking-fixtures';

/* ── Palette (morning ≠ afternoon at a glance; legend mirrors these) ───────── */
const AM_FILL = 'rgba(67,128,243,0.22)'; // morning — blue
const PM_FILL = 'rgba(101,99,238,0.22)'; // afternoon — indigo
const ALL_FILL = 'rgba(33,147,135,0.20)'; // all day — teal
const NA_FILL = 'rgba(216,47,47,0.06)'; // not available — soft pink
const AM_TEXT = '#2F60E8';
const PM_TEXT = '#5149D6';
const ALL_TEXT = '#1B7A70';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonth(cursor: Date): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

const TODAY_ISO = iso(new Date());

/* ════════════════════════════════════════════════════════════════════════════
   Schedule — two tabs: Guest Calendar · Kyle's Calendar
   ════════════════════════════════════════════════════════════════════════════ */

export function ScheduleView() {
  const [travelOpen, setTravelOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);

  return (
    <div className="px-12 py-8">
      <Tabs defaultValue="guest">
        <TabsList className="mb-6">
          <TabsTrigger value="guest">Guest Calendar</TabsTrigger>
          <TabsTrigger value="kyle">Kyle&apos;s Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="guest">
          <GuestCalendar />
        </TabsContent>

        <TabsContent value="kyle">
          <KyleCalendar
            onAddTravel={() => setTravelOpen(true)}
            onAddAvailability={() => setAvailOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <AddTravelModal open={travelOpen} onClose={() => setTravelOpen(false)} />
      <AddAvailabilityModal open={availOpen} onClose={() => setAvailOpen(false)} />
    </div>
  );
}

/* ── Shared month navigation header ────────────────────────────────────────── */

function MonthNav({
  cursor,
  setCursor,
  right
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-mx-field bg-white text-mx-body hover:border-mx-fieldHover"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="min-w-[180px] text-center text-[18px] font-bold text-mx-title">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-mx-field bg-white text-mx-body hover:border-mx-fieldHover"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 border-b border-mx-line bg-mx-lineSoft">
      {WEEKDAYS.map((w) => (
        <div key={w} className="px-3 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-mx-label">
          {w}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 1 — Guest Calendar (recordings only)
   ════════════════════════════════════════════════════════════════════════════ */

function GuestCalendar() {
  const { data } = useBooking();
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(() => buildMonth(cursor), [cursor]);

  const recByDate = useMemo(() => {
    const m = new Map<string, { g: Guest; conflict: boolean }[]>();
    data.guests.forEach((g) => {
      if (!g.recordingDate) return;
      const arr = m.get(g.recordingDate) || [];
      arr.push({ g, conflict: getConflicts(g, data.availability).has });
      m.set(g.recordingDate, arr);
    });
    return m;
  }, [data.guests, data.availability]);

  return (
    <div>
      <MonthNav cursor={cursor} setCursor={setCursor} />

      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] font-medium text-mx-secondary">
        <LegendDot color="#15171C" label="Recording" />
        <LegendDot color="#D82F2F" label="Conflict" />
      </div>

      <div className="overflow-hidden rounded-[16px] border border-mx-line bg-white shadow-card">
        <WeekdayHeader />
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const day = cell ? iso(cell) : '';
            const recs = cell ? recByDate.get(day) || [] : [];
            const isToday = day === TODAY_ISO;
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[120px] border-b border-r border-mx-line p-2 last:border-r-0',
                  !cell && 'bg-mx-lineSoft/40',
                  (i + 1) % 7 === 0 && 'border-r-0',
                  isToday && 'bg-mx-blueWash'
                )}
              >
                {cell && (
                  <>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-[12px] font-bold',
                          isToday
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-mx-blue text-white'
                            : 'text-mx-secondary'
                        )}
                      >
                        {cell.getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {recs.map(({ g, conflict }) => (
                        <button
                          key={g.id}
                          onClick={() => setSelected(g.id)}
                          className={cn(
                            'flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[10.5px] font-bold transition-opacity hover:opacity-90',
                            conflict
                              ? 'bg-mx-redBg text-mx-red ring-1 ring-mx-red'
                              : 'bg-mx-title text-white'
                          )}
                          title={`${g.name} · ${formatTime(g.recordingTime)}`}
                        >
                          {conflict && <AlertTriangle size={10} className="shrink-0" />}
                          <span className="truncate">
                            {initials(g.name)} {firstName(g.name)} {formatTime(g.recordingTime)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <GuestDrawer guestId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 2 — Kyle's Calendar (availability + travel)
   ════════════════════════════════════════════════════════════════════════════ */

interface DayAvail {
  morning?: AvailabilityBlock;
  afternoon?: AvailabilityBlock;
  allDay?: AvailabilityBlock;
  other: AvailabilityBlock[]; // not_available / unknown
}

function cellBackground(a: DayAvail): string {
  if (a.allDay) return ALL_FILL;
  const hasAM = !!a.morning;
  const hasPM = !!a.afternoon;
  if (hasAM && hasPM) return `linear-gradient(to bottom right, ${AM_FILL} 49.5%, ${PM_FILL} 50.5%)`;
  if (hasAM) return `linear-gradient(to bottom right, ${AM_FILL} 49.5%, ${NA_FILL} 50.5%)`;
  if (hasPM) return `linear-gradient(to bottom right, ${NA_FILL} 49.5%, ${PM_FILL} 50.5%)`;
  return NA_FILL; // busy-by-default
}

function rangeText(b: AvailabilityBlock): string {
  if (!b.from && !b.until) return '';
  return `${formatTime(b.from)}–${formatTime(b.until)}`;
}

function KyleCalendar({
  onAddTravel,
  onAddAvailability
}: {
  onAddTravel: () => void;
  onAddAvailability: () => void;
}) {
  const { data } = useBooking();
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [showSummaries, setShowSummaries] = useState(false);

  const cells = useMemo(() => buildMonth(cursor), [cursor]);

  const availByDate = useMemo(() => {
    const m = new Map<string, DayAvail>();
    data.availability.forEach((b) => {
      if (!b.date) return;
      const cur = m.get(b.date) || { other: [] };
      if (b.kind === 'morning') cur.morning = b;
      else if (b.kind === 'afternoon') cur.afternoon = b;
      else if (b.kind === 'all_day') cur.allDay = b;
      else cur.other.push(b);
      m.set(b.date, cur);
    });
    return m;
  }, [data.availability]);

  const recByDate = useMemo(() => {
    const m = new Map<string, { g: Guest; conflict: boolean }[]>();
    data.guests.forEach((g) => {
      if (!g.recordingDate) return;
      const arr = m.get(g.recordingDate) || [];
      arr.push({ g, conflict: getConflicts(g, data.availability).has });
      m.set(g.recordingDate, arr);
    });
    return m;
  }, [data.guests, data.availability]);

  function travelFor(day: string): TravelRange[] {
    return data.travel.filter((t) => t.start && t.end && day >= t.start && day <= t.end);
  }

  return (
    <div>
      <MonthNav
        cursor={cursor}
        setCursor={setCursor}
        right={
          <>
            <button
              type="button"
              onClick={() => setShowSummaries((v) => !v)}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover"
            >
              <ChevronDown size={14} className={cn('transition-transform', showSummaries && 'rotate-180')} /> Lists
            </button>
            <button
              type="button"
              onClick={onAddAvailability}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3.5 text-[13px] font-bold text-mx-body hover:border-mx-fieldHover"
            >
              <Sun size={15} className="text-mx-blue" /> Add Availability
            </button>
            <button
              type="button"
              onClick={onAddTravel}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3.5 text-[13px] font-bold text-mx-body hover:border-mx-fieldHover"
            >
              <Plane size={15} className="text-mx-link" /> Add Travel
            </button>
          </>
        }
      />

      {showSummaries && (
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SummaryList title="Kyle's Availability" empty="No availability blocks.">
            {[...data.availability]
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              .map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 px-3.5 py-2 text-[12.5px]">
                  <span className="font-semibold text-mx-title">{b.date}</span>
                  <span className="text-mx-secondary">
                    {b.kind.replace('_', ' ')} {rangeText(b) && `· ${rangeText(b)}`}
                  </span>
                </li>
              ))}
          </SummaryList>
          <SummaryList title="Kyle's Travel" empty="No travel planned.">
            {[...data.travel]
              .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
              .map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3.5 py-2 text-[12.5px]">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: t.color }} />
                  <span className="font-semibold text-mx-title">{t.destination}</span>
                  <span className="ml-auto text-mx-secondary">
                    {t.start} → {t.end}
                  </span>
                </li>
              ))}
          </SummaryList>
        </div>
      )}

      {/* Legend mirrors the fills — placed above the calendar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] font-medium text-mx-secondary">
        <LegendSwatch fill={AM_FILL} label="Morning" />
        <LegendSwatch fill={PM_FILL} label="Afternoon" />
        <LegendSwatch fill={ALL_FILL} label="All day" />
        <LegendSwatch fill={NA_FILL} label="Not available" />
        <LegendDot color="#15171C" label="Recording" />
        <LegendDot color="#D82F2F" label="Conflict" />
      </div>

      <div className="overflow-hidden rounded-[16px] border border-mx-line bg-white shadow-card">
        <WeekdayHeader />
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const day = cell ? iso(cell) : '';
            const avail = cell ? availByDate.get(day) || { other: [] } : { other: [] };
            const travels = cell ? travelFor(day) : [];
            const recs = cell ? recByDate.get(day) || [] : [];
            const isToday = day === TODAY_ISO;
            const blocks = cell
              ? [avail.morning, avail.afternoon, avail.allDay, ...avail.other].filter(
                  Boolean
                ) as AvailabilityBlock[]
              : [];
            return (
              <div
                key={i}
                className={cn(
                  'relative flex min-h-[120px] flex-col border-b border-r border-mx-line p-1.5 last:border-r-0',
                  (i + 1) % 7 === 0 && 'border-r-0'
                )}
                style={{ background: cell ? cellBackground(avail) : undefined }}
              >
                {cell && (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-[12px] font-bold',
                          isToday
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-mx-blue text-white'
                            : 'text-mx-secondary'
                        )}
                      >
                        {cell.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {recs.map(({ g, conflict }) =>
                          conflict ? (
                            <AlertTriangle key={g.id} size={12} className="text-mx-red" />
                          ) : (
                            <span
                              key={g.id}
                              className="h-2 w-2 rounded-full bg-mx-title"
                              title={`Recording · ${g.name}`}
                            />
                          )
                        )}
                      </div>
                    </div>

                    {/* Availability time labels inside the colored region */}
                    <div className="flex flex-1 flex-col gap-0.5">
                      {blocks.map((b) => {
                        const color =
                          b.kind === 'morning'
                            ? AM_TEXT
                            : b.kind === 'afternoon'
                              ? PM_TEXT
                              : b.kind === 'all_day'
                                ? ALL_TEXT
                                : '#B72525';
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              'text-[9.5px] font-bold leading-tight',
                              b.kind === 'afternoon' && 'text-right'
                            )}
                            style={{ color }}
                            title={b.note || undefined}
                          >
                            {rangeText(b) || (b.kind === 'all_day' ? 'All day' : 'Unavailable')}
                            {b.note && <span className="block font-medium opacity-80">{b.note}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Travel bars across the bottom */}
                    {travels.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {travels.map((t) => (
                          <div
                            key={t.id}
                            className="truncate rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-bold text-white"
                            style={{ background: t.color }}
                            title={t.destination}
                          >
                            {day === t.start ? t.destination : '\u00A0'}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function SummaryList({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="rounded-[14px] border border-mx-line bg-white shadow-card">
      <div className="border-b border-mx-line px-3.5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-mx-label">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-mx-muted">{empty}</p>
      ) : (
        <ul className="max-h-[220px] divide-y divide-mx-line overflow-y-auto">{children}</ul>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function LegendSwatch({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px] border border-mx-line" style={{ background: fill }} /> {label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Add modals (write to Supabase via provider; reflect through realtime)
   ════════════════════════════════════════════════════════════════════════════ */

function AddTravelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTravel } = useBooking();
  const [destination, setDestination] = useState('');
  const [color, setColor] = useState('#6563EE');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  function submit() {
    if (!destination.trim()) return setError('Please enter a destination.');
    if (!start) return setError('Please choose a start date.');
    if (end && end < start) return setError('End date can’t be before the start date.');
    addTravel({
      destination: destination.trim(),
      color,
      start,
      end: end || start
    });
    setDestination('');
    setStart('');
    setEnd('');
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-[460px] bg-white text-mx-title"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[19px] font-bold">Add Travel</DialogTitle>
        </DialogHeader>
        <div className="mt-3 flex flex-col gap-3">
          <FieldRow label="Destination">
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="NYC — speaking" className="bg-white" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Start"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-white" /></FieldRow>
            <FieldRow label="End"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-white" /></FieldRow>
          </div>
          <FieldRow label="Color">
            <div className="flex gap-2">
              {['#6563EE', '#4380F3', '#219387', '#E0A106', '#D82F2F'].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn('h-8 w-8 rounded-lg border-2', color === c ? 'border-mx-title' : 'border-transparent')} style={{ background: c }} />
              ))}
            </div>
          </FieldRow>
        </div>
        {error && <p className="mt-4 text-[12.5px] font-semibold text-mx-red">{error}</p>}
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={close} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
          <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">Add Travel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAvailabilityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAvailability } = useBooking();
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<AvailabilityKind>('morning');
  const [from, setFrom] = useState('08:00');
  const [until, setUntil] = useState('12:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  function submit() {
    if (!date) return setError('Please choose a date for this block.');
    const timed = kind === 'morning' || kind === 'afternoon';
    if (timed && from && until && until <= from) {
      return setError('“Until” must be later than “From”.');
    }
    addAvailability({ date, kind, from, until, note: note.trim() || undefined });
    setDate('');
    setNote('');
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-[460px] bg-white text-mx-title"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[19px] font-bold">Add Availability</DialogTitle>
        </DialogHeader>
        <div className="mt-3 flex flex-col gap-3">
          <FieldRow label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white" /></FieldRow>
          <FieldRow label="Type">
            <Select value={kind} onValueChange={(v) => setKind(v as AvailabilityKind)}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="all_day">All day</SelectItem>
                <SelectItem value="not_available">Not available</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="From"><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" /></FieldRow>
            <FieldRow label="Until"><Input type="time" value={until} onChange={(e) => setUntil(e.target.value)} className="bg-white" /></FieldRow>
          </div>
          <FieldRow label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recording window" className="bg-white" /></FieldRow>
        </div>
        {error && <p className="mt-4 text-[12.5px] font-semibold text-mx-red">{error}</p>}
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={close} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
          <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">Add Block</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-mx-title">{label}</span>
      {children}
    </label>
  );
}
