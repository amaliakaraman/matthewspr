'use client';

import {
  AlertTriangle,
  MapPin,
  Lock,
  Pencil,
  Trash2,
  Mail,
  Clock
} from 'lucide-react';
import { Checkbox } from '@matthewsreis/ui/checkbox';
import { Input } from '@matthewsreis/ui/input';
import { Button } from '@matthewsreis/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@matthewsreis/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@matthewsreis/ui/sheet';
import { cn } from '@/lib/utils';
import { StatusPill, ProgressRing, SectionLabel, Avatar } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import {
  TASKS,
  PENDING_REASONS,
  deriveStatus,
  doneCount,
  getConflicts,
  guestName,
  formatTime,
  dateOnly,
  type Guest,
  type TaskDef,
  type AvailabilityBlock
} from '@/lib/demo/booking-fixtures';
import { STAGE_META } from './stage-meta';

export function GuestDrawer({
  guestId,
  onClose
}: {
  guestId: string | null;
  onClose: () => void;
}) {
  const { data } = useBooking();
  const guest = guestId ? data.guests.find((g) => g.id === guestId) || null : null;

  return (
    <Sheet open={!!guest} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[520px] overflow-y-auto bg-white p-0 text-mx-title sm:max-w-[520px]"
      >
        {guest && <DrawerBody guest={guest} availability={data.availability} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  guest,
  availability,
  onClose
}: {
  guest: Guest;
  availability: AvailabilityBlock[];
  onClose: () => void;
}) {
  const {
    toggleTask,
    setTaskField,
    setConfirmed,
    setPendingReason,
    openEditGuest,
    removeGuest
  } = useBooking();

  const stage = deriveStatus(guest);
  const conflicts = getConflicts(guest, availability);
  const meta = STAGE_META[stage];
  const dt = dateOnly(guest.recordingDate);
  const dateLabel = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const pre = TASKS.filter((t) => t.phase === 'pre');
  const post = TASKS.filter((t) => t.phase === 'post');

  return (
    <div>
      {/* Header */}
      <SheetHeader className="border-b border-mx-line px-6 pb-5 pt-6 text-left">
        <div className="flex items-start gap-3">
          <Avatar name={guestName(guest)} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[19px] font-bold text-mx-title">
              {guestName(guest)}
            </SheetTitle>
            <SheetDescription className="text-[13px] text-mx-secondary">
              {guest.episode != null ? `Ep. ${guest.episode} · ` : ''}
              {dateLabel} · {formatTime(guest.recordingTime)} · {guest.duration}m
            </SheetDescription>
          </div>
          <StatusPill tone={meta.tone} dot>
            {meta.label}
          </StatusPill>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill tone={guest.location === 'nashville' ? 'teal' : 'grey'}>
            <MapPin size={11} /> {guest.location === 'nashville' ? 'Nashville' : 'Away'}
          </StatusPill>
          {guest.email && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mx-link">
              <Mail size={12} /> {guest.email}
            </span>
          )}
          {conflicts.has && (
            <StatusPill tone="red">
              <AlertTriangle size={11} /> Conflict
            </StatusPill>
          )}
        </div>

        {guest.notes && (
          <p className="mt-3 text-[13px] leading-relaxed text-mx-body">{guest.notes}</p>
        )}
      </SheetHeader>

      <div className="px-6 py-5">
        {/* Conflict banners */}
        {conflicts.messages.map((m, i) => (
          <div
            key={i}
            className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#F3C4C4] bg-mx-redBg px-3.5 py-3 text-[13px] font-medium text-mx-red"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{m}</span>
          </div>
        ))}

        {/* Confirm gate */}
        {!guest.confirmed ? (
          <div className="rounded-[14px] border border-mx-line bg-mx-lineSoft p-5">
            <div className="flex items-center gap-2 text-[14px] font-bold text-mx-title">
              <Lock size={15} className="text-mx-muted" /> Tasks locked
            </div>
            <p className="mt-1 text-[13px] text-mx-secondary">
              Confirm the guest to unlock tasks.
            </p>

            <div className="mt-4">
              <span className="mb-1.5 block text-[13px] font-bold text-mx-title">
                Reason for Pending
              </span>
              <Select
                value={guest.pendingReason || ''}
                onValueChange={(v) => setPendingReason(guest.id, v, guest.pendingReasonOther)}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {PENDING_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {guest.pendingReason === 'Other' && (
                <Input
                  value={guest.pendingReasonOther || ''}
                  onChange={(e) => setPendingReason(guest.id, 'Other', e.target.value)}
                  placeholder="Add a note…"
                  className="mt-2 bg-white"
                />
              )}
            </div>

            <Button
              onClick={() => setConfirmed(guest.id, true)}
              className="mt-4 h-[38px] w-full rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep"
            >
              Mark Confirmed
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[13px] font-bold text-mx-title">Checklist</span>
              <ProgressRing
                value={doneCount(guest)}
                max={12}
                tone={doneCount(guest) === 12 ? 'green' : 'blue'}
              />
            </div>

            <TaskGroup
              title="Pre-recording"
              tasks={pre}
              guest={guest}
              hotelConflict={conflicts.hotelConflict}
              onToggle={(t) => toggleTask(guest.id, t)}
              onField={(k, v) => setTaskField(guest.id, k, v)}
            />
            <div className="h-5" />
            <TaskGroup
              title="Post-recording"
              tasks={post}
              guest={guest}
              hotelConflict={false}
              onToggle={(t) => toggleTask(guest.id, t)}
              onField={(k, v) => setTaskField(guest.id, k, v)}
            />
          </>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-mx-line pt-4">
          {guest.confirmed && (
            <button
              onClick={() => setConfirmed(guest.id, false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover"
            >
              <Lock size={13} /> Unconfirm
            </button>
          )}
          <button
            onClick={() => openEditGuest(guest.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-mx-field bg-white px-3 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => {
              removeGuest(guest.id);
              onClose();
            }}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-mx-red hover:bg-mx-redBg"
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  guest,
  hotelConflict,
  onToggle,
  onField
}: {
  title: string;
  tasks: TaskDef[];
  guest: Guest;
  hotelConflict: boolean;
  onToggle: (t: Guest['done'][number]) => void;
  onField: (key: string, value: string) => void;
}) {
  return (
    <div>
      <SectionLabel className="mb-3">{title}</SectionLabel>
      <ol className="flex flex-col gap-1.5">
        {tasks.map((task) => {
          const checked = guest.done.includes(task.id);
          const isHotel = task.id === 'hotel';
          return (
            <li
              key={task.id}
              className={cn(
                'rounded-xl border px-3.5 py-3 transition-colors',
                checked ? 'border-mx-line bg-mx-lineSoft' : 'border-mx-line bg-white',
                isHotel && hotelConflict && 'border-[#F3C4C4] bg-mx-redBg'
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(task.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggle(task.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        'text-[14px] font-semibold',
                        checked ? 'text-mx-muted line-through' : 'text-mx-title'
                      )}
                    >
                      {task.label}
                    </span>
                    {task.appliesTo === 'nashville' && (
                      <StatusPill tone="grey" className="px-1.5 py-0.5 text-[10px]">
                        Nashville
                      </StatusPill>
                    )}
                  </button>
                  {task.sub && (
                    <p className="mt-0.5 text-[12px] text-mx-secondary">{task.sub}</p>
                  )}

                  {task.fields && (
                    <div className="mt-2.5 flex flex-wrap gap-3">
                      {task.fields.map((f) => (
                        <label key={f.key} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-mx-label">
                            {f.label}
                          </span>
                          <div className="relative">
                            {f.type === 'time' && (
                              <Clock
                                size={13}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mx-muted"
                              />
                            )}
                            <Input
                              type={f.type}
                              value={guest.fields?.[f.key] || ''}
                              onChange={(e) => onField(f.key, e.target.value)}
                              className={cn(
                                'h-9 w-[160px] bg-white',
                                f.type === 'time' && 'pl-8',
                                isHotel && hotelConflict && f.key === 'hotelCheckOut'
                                  ? 'border-mx-red'
                                  : ''
                              )}
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
