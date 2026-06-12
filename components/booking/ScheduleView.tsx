'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plane, Sun } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useBooking } from './BookingProvider';
import {
  getConflicts,
  dateOnly,
  formatTime,
  type AvailabilityKind,
  type Guest
} from '@/lib/demo/booking-fixtures';

const AVAIL_COLOR: Record<AvailabilityKind, { bar: string; text: string; label: string }> = {
  morning: { bar: '#4380F3', text: '#2F60E8', label: 'Morning' },
  afternoon: { bar: '#6563EE', text: '#5149D6', label: 'Afternoon' },
  all_day: { bar: '#219387', text: '#1B7A70', label: 'All day' },
  not_available: { bar: '#D82F2F', text: '#B72525', label: 'Unavailable' }
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function initials(g: Guest): string {
  return g.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ScheduleView() {
  const { data } = useBooking();
  const [cursor, setCursor] = useState(() => new Date(2026, 5, 1)); // June 2026 (demo-anchored)
  const [layers, setLayers] = useState({ recordings: true, availability: true, travel: true });
  const [travelOpen, setTravelOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);

  const cells = useMemo(() => buildMonth(cursor), [cursor]);

  const recByDate = useMemo(() => {
    const m = new Map<string, { g: Guest; conflict: boolean }[]>();
    data.guests.forEach((g) => {
      const arr = m.get(g.recordingDate) || [];
      arr.push({ g, conflict: getConflicts(g, data.availability).has });
      m.set(g.recordingDate, arr);
    });
    return m;
  }, [data.guests, data.availability]);

  const availByDate = useMemo(() => {
    const m = new Map<string, typeof data.availability>();
    data.availability.forEach((b) => {
      const arr = m.get(b.date) || [];
      arr.push(b);
      m.set(b.date, arr);
    });
    return m;
  }, [data.availability]);

  function travelFor(day: string) {
    return data.travel.filter((t) => day >= t.start && day <= t.end);
  }

  return (
    <div className="px-12 py-8">
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

        <div className="flex flex-wrap items-center gap-2">
          <LayerToggle label="Recordings" active={layers.recordings} dot="#15171C" onClick={() => setLayers((l) => ({ ...l, recordings: !l.recordings }))} />
          <LayerToggle label="Availability" active={layers.availability} dot="#4380F3" onClick={() => setLayers((l) => ({ ...l, availability: !l.availability }))} />
          <LayerToggle label="Travel" active={layers.travel} dot="#6563EE" onClick={() => setLayers((l) => ({ ...l, travel: !l.travel }))} />
          <button onClick={() => setAvailOpen(true)} className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover">
            <Sun size={14} /> Availability
          </button>
          <button onClick={() => setTravelOpen(true)} className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover">
            <Plane size={14} /> Travel
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="overflow-hidden rounded-[16px] border border-mx-line bg-white shadow-card">
        <div className="grid grid-cols-7 border-b border-mx-line bg-mx-lineSoft">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-3 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-mx-label">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const day = cell ? iso(cell) : '';
            const recs = cell && layers.recordings ? recByDate.get(day) || [] : [];
            const avails = cell && layers.availability ? availByDate.get(day) || [] : [];
            const travels = cell && layers.travel ? travelFor(day) : [];
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[118px] border-b border-r border-mx-line p-2 last:border-r-0',
                  !cell && 'bg-mx-lineSoft/40',
                  (i + 1) % 7 === 0 && 'border-r-0'
                )}
              >
                {cell && (
                  <>
                    <div className="mb-1.5 text-[12px] font-bold text-mx-secondary">{cell.getDate()}</div>
                    <div className="flex flex-col gap-1">
                      {avails.map((b) => {
                        const c = AVAIL_COLOR[b.kind];
                        return (
                          <div
                            key={b.id}
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: `${c.bar}1A`, color: c.text }}
                            title={b.note}
                          >
                            {c.label} {b.kind !== 'not_available' && b.kind !== 'all_day' ? `${formatTime(b.from)}` : ''}
                          </div>
                        );
                      })}
                      {travels.map((t) => (
                        <div
                          key={t.id}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-white"
                          style={{ background: t.color }}
                          title={t.destination}
                        >
                          {day === t.start ? t.destination : '·'}
                        </div>
                      ))}
                      {recs.map(({ g, conflict }) => (
                        <div
                          key={g.id}
                          className={cn(
                            'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold',
                            conflict ? 'bg-mx-redBg text-mx-red ring-1 ring-mx-red' : 'bg-mx-title text-white'
                          )}
                          title={`${g.name} · ${formatTime(g.recordingTime)}`}
                        >
                          {initials(g)} {formatTime(g.recordingTime).replace(':00', '')}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] font-medium text-mx-secondary">
        <LegendDot color="#15171C" label="Recording" />
        <LegendDot color="#D82F2F" label="Conflict" />
        <LegendDot color="#4380F3" label="Morning" />
        <LegendDot color="#6563EE" label="Afternoon" />
        <LegendDot color="#219387" label="All day" />
        <LegendDot color="#8A909A" label="Travel ranges shown as bars" />
      </div>

      <AddTravelModal open={travelOpen} onClose={() => setTravelOpen(false)} />
      <AddAvailabilityModal open={availOpen} onClose={() => setAvailOpen(false)} />
    </div>
  );
}

function buildMonth(cursor: Date): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function LayerToggle({ label, active, dot, onClick }: { label: string; active: boolean; dot: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-[38px] items-center gap-2 rounded-lg border px-3 text-[12.5px] font-bold transition-colors',
        active ? 'border-mx-blue bg-[rgba(67,128,243,0.06)] text-mx-title' : 'border-mx-field bg-white text-mx-muted'
      )}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? dot : '#C4C8CE' }} />
      {label}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function AddTravelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTravel } = useBooking();
  const [destination, setDestination] = useState('');
  const [color, setColor] = useState('#6563EE');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function submit() {
    addTravel({ destination: destination.trim() || 'Travel', color, start: start || '2026-06-15', end: end || start || '2026-06-15' });
    setDestination(''); setStart(''); setEnd('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={onClose} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
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

  function submit() {
    addAvailability({ date: date || '2026-06-16', kind, from, until, note: note.trim() || undefined });
    setDate(''); setNote('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={onClose} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
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
