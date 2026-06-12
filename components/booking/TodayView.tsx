'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Mic,
  MessageSquareReply,
  MapPin,
  ArrowRight,
  Bell,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard, StatusPill, ProgressBar, Avatar } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import {
  doneCount,
  getConflicts,
  getReminders,
  guestName,
  formatTime,
  dateOnly,
  daysUntil,
  type Reminder,
  type Urgency,
  type ReminderEntry
} from '@/lib/demo/booking-fixtures';

const URGENCY_STYLE: Record<Urgency, string> = {
  overdue: 'bg-mx-redBg text-mx-red',
  soon: 'bg-[#FCEBD8] text-[#C2660B]',
  later: 'bg-mx-amberBg text-mx-amber'
};

export function TodayView() {
  const { data } = useBooking();

  const reminders = useMemo(() => getReminders(data.guests), [data.guests]);

  const thisWeek = useMemo(
    () =>
      data.guests
        .map((g) => ({ g, d: daysUntil(g.recordingDate) }))
        .filter(({ g, d }) => g.confirmed && d >= 0 && d <= 7)
        .sort((a, b) => a.d - b.d),
    [data.guests]
  );

  const conflicts = useMemo(
    () =>
      data.guests
        .map((g) => ({ g, c: getConflicts(g, data.availability) }))
        .filter(({ c }) => c.has),
    [data.guests, data.availability]
  );

  const replies = useMemo(
    () => data.outreach.filter((o) => o.response === 'responded'),
    [data.outreach]
  );

  return (
    <div className="px-12 py-8">
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<AlertTriangle size={20} />}
          iconClass="bg-mx-redBg text-mx-red"
          value={reminders.length}
          label="Needs attention"
        />
        <StatCard
          icon={<Mic size={20} />}
          value={thisWeek.length}
          label="Recording this week"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          iconClass="bg-mx-amberBg text-mx-amber"
          value={conflicts.length}
          label="Open conflicts"
        />
        <StatCard
          icon={<MessageSquareReply size={20} />}
          iconClass="bg-mx-greenBg text-mx-green"
          value={replies.length}
          label="Outreach replies"
        />
      </div>

      {/* Upcoming reminders — front-and-center for the whole team */}
      <RemindersCard />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Needs attention */}
        <Panel
          title="Needs attention"
          icon={<AlertTriangle size={15} className="text-mx-red" />}
          empty={reminders.length === 0 ? 'Nothing urgent — all deadlines clear.' : undefined}
          href="/bookings"
        >
          {reminders.map((r) => (
            <ReminderRow key={`${r.guestId}-${r.taskId}`} r={r} />
          ))}
        </Panel>

        {/* This week's recordings */}
        <Panel
          title="This week's recordings"
          icon={<CalendarClock size={15} className="text-mx-blue" />}
          empty={thisWeek.length === 0 ? 'No recordings in the next 7 days.' : undefined}
          href="/schedule"
        >
          {thisWeek.map(({ g, d }) => {
            return (
              <Link
                key={g.id}
                href="/bookings"
                className="flex items-center gap-3 rounded-xl border border-mx-line bg-white px-3.5 py-3 transition-colors hover:border-mx-fieldHover"
              >
                <Avatar name={guestName(g)} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold text-mx-title">{guestName(g)}</span>
                    <StatusPill tone={g.location === 'nashville' ? 'teal' : 'grey'} className="px-1.5 py-0.5 text-[10px]">
                      <MapPin size={10} /> {g.location === 'nashville' ? 'Nashville' : 'Away'}
                    </StatusPill>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={doneCount(g)} max={12} className="max-w-[140px]" />
                    <span className="text-[11.5px] font-semibold text-mx-muted">{doneCount(g)}/12</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-mx-title">
                    {dateOnly(g.recordingDate).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-[11.5px] text-mx-secondary">
                    {d === 0 ? 'Today' : `${d}d`} · {formatTime(g.recordingTime)}
                  </div>
                </div>
              </Link>
            );
          })}
        </Panel>

        {/* Conflicts */}
        <Panel
          title="Conflicts"
          icon={<AlertTriangle size={15} className="text-mx-red" />}
          empty={conflicts.length === 0 ? 'No scheduling conflicts detected.' : undefined}
          href="/bookings"
        >
          {conflicts.map(({ g, c }) => (
            <Link
              key={g.id}
              href="/bookings"
              className="block rounded-xl border border-mx-red bg-mx-redBg px-3.5 py-3 transition-opacity hover:opacity-90"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-mx-title">{guestName(g)}</span>
                <span className="text-[12px] text-mx-secondary">
                  {dateOnly(g.recordingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTime(g.recordingTime)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] font-medium text-mx-red">{c.messages[0]}</p>
            </Link>
          ))}
        </Panel>

        {/* Recent outreach replies */}
        <Panel
          title="Recent outreach replies"
          icon={<MessageSquareReply size={15} className="text-mx-green" />}
          empty={replies.length === 0 ? 'No new replies.' : undefined}
          href="/outreach"
        >
          {replies.map((o) => (
            <Link
              key={o.id}
              href="/outreach"
              className="flex items-center gap-3 rounded-xl border border-mx-line bg-white px-3.5 py-3 transition-colors hover:border-mx-fieldHover"
            >
              <Avatar name={o.name} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-mx-title">{o.name}</div>
                <div className="truncate text-[12px] text-mx-secondary">{o.business}{o.note ? ` · ${o.note}` : ''}</div>
              </div>
              <StatusPill tone="green" dot>Responded</StatusPill>
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function RemindersCard() {
  const { data } = useBooking();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reminders = useMemo(
    () =>
      [...data.reminders].sort((a, b) =>
        (a.reminderDate || '9999').localeCompare(b.reminderDate || '9999')
      ),
    [data.reminders]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mb-7 rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 border-b border-mx-line pb-3">
        <Bell size={15} className="text-mx-amber" />
        <span className="text-[14px] font-bold text-mx-title">Upcoming reminders</span>
        <StatusPill tone="amber" className="ml-auto">
          {reminders.length}
        </StatusPill>
      </div>

      {reminders.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-mx-muted">No reminders yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map((r) => (
            <RemindersRow key={r.id} r={r} open={expanded.has(r.id)} onToggle={() => toggle(r.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RemindersRow({
  r,
  open,
  onToggle
}: {
  r: ReminderEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const dateLabel = r.reminderDate
    ? dateOnly(r.reminderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date';
  return (
    <li className="rounded-xl border border-mx-line bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-mx-lineSoft/60"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-mx-title">{r.title || 'Untitled reminder'}</div>
          <div className="text-[12px] text-mx-secondary">
            Remind {dateLabel}
            {r.eventDate && ` · event ${dateOnly(r.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </div>
        </div>
        {r.info && (
          <ChevronDown
            size={16}
            className={cn('shrink-0 text-mx-muted transition-transform', open && 'rotate-180')}
          />
        )}
      </button>
      {open && r.info && (
        <div className="whitespace-pre-line border-t border-mx-line px-3.5 py-3 text-[13px] leading-relaxed text-mx-body">
          {r.info}
        </div>
      )}
    </li>
  );
}

function ReminderRow({ r }: { r: Reminder }) {
  return (
    <Link
      href="/bookings"
      className="flex items-center gap-3 rounded-xl border border-mx-line bg-white px-3.5 py-3 transition-colors hover:border-mx-fieldHover"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-mx-title">{r.guestName}</div>
        <div className="truncate text-[12.5px] text-mx-secondary">{r.taskLabel}</div>
      </div>
      <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none', URGENCY_STYLE[r.urgency])}>
        {r.badge}
      </span>
    </Link>
  );
}

function Panel({
  title,
  icon,
  href,
  empty,
  children
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between border-b border-mx-line pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[14px] font-bold text-mx-title">{title}</span>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-bold text-mx-link hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      {empty ? (
        <p className="py-4 text-center text-[13px] text-mx-muted">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}
