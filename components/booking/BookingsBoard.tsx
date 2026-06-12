'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusPill, ProgressRing, Avatar } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import { GuestDrawer } from './GuestDrawer';
import { STAGE_META } from './stage-meta';
import {
  STAGES,
  deriveStatus,
  doneCount,
  getConflicts,
  guestName,
  formatTime,
  dateOnly,
  type DerivedStage,
  type Guest,
  type LocationKind
} from '@/lib/demo/booking-fixtures';

type LocFilter = 'all' | LocationKind;

export function BookingsBoard() {
  const { data } = useBooking();
  const [selected, setSelected] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<DerivedStage | 'all'>('all');
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [locFilter, setLocFilter] = useState<LocFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<DerivedStage>>(new Set());

  const decorated = useMemo(
    () =>
      data.guests.map((g) => ({
        guest: g,
        stage: deriveStatus(g),
        conflict: getConflicts(g, data.availability)
      })),
    [data.guests, data.availability]
  );

  const counts = useMemo(() => {
    const c: Record<DerivedStage, number> = {
      pending: 0,
      in_progress: 0,
      recorded: 0,
      completed: 0
    };
    decorated.forEach((d) => (c[d.stage] += 1));
    return c;
  }, [decorated]);

  const filtered = decorated.filter((d) => {
    if (conflictsOnly && !d.conflict.has) return false;
    if (locFilter !== 'all' && d.guest.location !== locFilter) return false;
    return true;
  });

  const stagesToShow = stageFilter === 'all' ? STAGES : STAGES.filter((s) => s.id === stageFilter);

  function toggleCollapse(id: DerivedStage) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="px-12 py-8">
      {/* Pipeline rail */}
      <div className="mb-6 flex flex-wrap items-stretch gap-3">
        <RailChip
          active={stageFilter === 'all'}
          onClick={() => setStageFilter('all')}
          label="All"
          count={decorated.length}
          dot="bg-mx-muted"
        />
        {STAGES.map((s) => (
          <RailChip
            key={s.id}
            active={stageFilter === s.id}
            onClick={() => setStageFilter(stageFilter === s.id ? 'all' : s.id)}
            label={s.label}
            count={counts[s.id]}
            dot={STAGE_META[s.id].dot}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setConflictsOnly((v) => !v)}
            className={cn(
              'inline-flex h-[38px] items-center gap-2 rounded-lg border px-3.5 text-[13px] font-bold transition-colors',
              conflictsOnly
                ? 'border-[#F3C4C4] bg-mx-redBg text-mx-red'
                : 'border-mx-field bg-white text-mx-body hover:border-mx-fieldHover'
            )}
          >
            <AlertTriangle size={14} /> Conflicts only
          </button>
          <div className="flex h-[38px] items-center rounded-lg border border-mx-field bg-white p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'nashville', label: 'Nashville' },
                { id: 'away', label: 'Away' }
              ] as { id: LocFilter; label: string }[]
            ).map((l) => (
              <button
                key={l.id}
                onClick={() => setLocFilter(l.id)}
                className={cn(
                  'h-[30px] rounded-md px-3 text-[12.5px] font-bold transition-colors',
                  locFilter === l.id ? 'bg-mx-blue text-white' : 'text-mx-secondary hover:text-mx-title'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stage-grouped sections */}
      <div className="flex flex-col gap-7">
        {stagesToShow.map((s) => {
          const items = filtered
            .filter((d) => d.stage === s.id)
            .sort((a, b) => recKey(a.guest) - recKey(b.guest));
          const isCollapsed = collapsed.has(s.id);
          return (
            <section key={s.id}>
              <button
                onClick={() => toggleCollapse(s.id)}
                className="mb-4 flex w-full items-center gap-2.5 border-b border-mx-line pb-2.5 text-left"
              >
                <ChevronDown
                  size={16}
                  className={cn('text-mx-muted transition-transform', isCollapsed && '-rotate-90')}
                />
                <span className={cn('h-2 w-2 rounded-full', STAGE_META[s.id].dot)} />
                <span className="text-[14px] font-bold text-mx-title">{s.label}</span>
                <span className="text-[13px] font-semibold text-mx-muted">{items.length}</span>
              </button>

              {!isCollapsed &&
                (items.length === 0 ? (
                  <p className="px-1 pb-2 text-[13px] text-mx-muted">No guests in this stage.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {items.map(({ guest, stage, conflict }) => (
                      <GuestCard
                        key={guest.id}
                        guest={guest}
                        stage={stage}
                        conflict={conflict}
                        onClick={() => setSelected(guest.id)}
                      />
                    ))}
                  </div>
                ))}
            </section>
          );
        })}
      </div>

      <GuestDrawer guestId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function recKey(g: Guest): number {
  const d = dateOnly(g.recordingDate).getTime();
  const [h, m] = (g.recordingTime || '00:00').split(':').map(Number);
  return d + (h || 0) * 60000 + (m || 0) * 1000;
}

function RailChip({
  active,
  onClick,
  label,
  count,
  dot
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors',
        active
          ? 'border-mx-blue bg-[rgba(67,128,243,0.06)]'
          : 'border-mx-line bg-white hover:border-mx-fieldHover'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      <span className="text-[13.5px] font-bold text-mx-title">{label}</span>
      <span
        className={cn(
          'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11.5px] font-bold',
          active ? 'bg-mx-blue text-white' : 'bg-mx-lineSoft text-mx-secondary'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function GuestCard({
  guest,
  stage,
  conflict,
  onClick
}: {
  guest: Guest;
  stage: DerivedStage;
  conflict: ReturnType<typeof getConflicts>;
  onClick: () => void;
}) {
  const meta = STAGE_META[stage];
  const dateLabel = guest.recordingDate
    ? dateOnly(guest.recordingDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : 'No Date';
  const subMeta = [dateLabel, formatTime(guest.recordingTime), `${guest.duration}m`]
    .filter(Boolean)
    .join(' · ');
  const done = doneCount(guest);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-3.5 rounded-[16px] border bg-white p-4 text-left shadow-card transition-all hover:shadow-cardHover',
        conflict.has ? 'border-mx-red' : 'border-mx-line'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-1 h-3 w-3 shrink-0 rounded-[4px]',
            guest.location === 'nashville' ? 'bg-mx-teal' : 'bg-mx-muted'
          )}
          title={guest.location === 'nashville' ? 'Nashville' : 'Away'}
        />
        <Avatar name={guestName(guest)} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-mx-title">{guestName(guest)}</span>
            {guest.episode != null && (
              <span className="shrink-0 text-[12px] font-semibold text-mx-muted">Ep. {guest.episode}</span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-mx-secondary">{subMeta}</p>
        </div>
        <ProgressRing value={done} max={12} size={40} tone={done === 12 ? 'green' : 'blue'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={meta.tone} dot>
          {meta.label}
        </StatusPill>
        <StatusPill tone={guest.location === 'nashville' ? 'teal' : 'grey'}>
          <MapPin size={11} /> {guest.location === 'nashville' ? 'Nashville' : 'Away'}
        </StatusPill>
        {conflict.has && (
          <StatusPill tone="red">
            <AlertTriangle size={11} /> Conflict
          </StatusPill>
        )}
      </div>
    </button>
  );
}
