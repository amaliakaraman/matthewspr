'use client';

import { useEffect, useState } from 'react';
import { Button } from '@matthewsreis/ui/button';
import { Input } from '@matthewsreis/ui/input';
import { Textarea } from '@matthewsreis/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@matthewsreis/ui/dialog';
import { cn } from '@/lib/utils';
import { useBooking } from './BookingProvider';
import type { Guest, LocationKind } from '@/lib/demo/booking-fixtures';

interface FormState {
  name: string;
  email: string;
  recordingDate: string;
  recordingTime: string;
  duration: string;
  episode: string;
  location: LocationKind;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  recordingDate: '',
  recordingTime: '',
  duration: '90',
  episode: '',
  location: 'nashville',
  notes: ''
};

export function GuestModal() {
  const { guestModal, closeGuestModal, addGuest, updateGuest, data } = useBooking();
  const editing = guestModal.editId
    ? data.guests.find((g) => g.id === guestModal.editId)
    : null;

  const requireDate = guestModal.requireDate ?? false;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  // Shown on the Schedule path when date/time are missing: offer to keep
  // editing, save as Pending (no date), or discard.
  const [pendingPrompt, setPendingPrompt] = useState(false);

  useEffect(() => {
    if (!guestModal.open) return;
    setError(null);
    setPendingPrompt(false);
    if (editing) {
      setForm({
        name: editing.name,
        email: editing.email || '',
        recordingDate: editing.recordingDate,
        recordingTime: editing.recordingTime,
        duration: String(editing.duration),
        episode: editing.episode != null ? String(editing.episode) : '',
        location: editing.location,
        notes: editing.notes || ''
      });
    } else {
      setForm(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestModal.open, guestModal.editId]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function persist(recordingDate: string, recordingTime: string) {
    const base = {
      name: form.name.trim(),
      email: form.email.trim(),
      recordingDate,
      recordingTime,
      duration: Number(form.duration) || 90,
      episode: form.episode ? Number(form.episode) : undefined,
      location: form.location,
      notes: form.notes.trim()
    };
    if (editing) {
      updateGuest(editing.id, base);
    } else {
      const g: Guest = {
        id: `g-${Date.now()}`,
        ...base,
        confirmed: false,
        done: [],
        fields: {}
      };
      addGuest(g);
    }
    closeGuestModal();
  }

  function submit() {
    if (!form.name.trim()) return setError('Please enter the guest’s full name.');
    const hasDate = !!form.recordingDate;
    const hasTime = !!form.recordingTime;

    if (hasDate && hasTime) {
      return persist(form.recordingDate, form.recordingTime);
    }

    if (requireDate) {
      // Schedule: can't place a guest without a date + time. Offer choices.
      setError(null);
      setPendingPrompt(true);
      return;
    }

    // Bookings / Today: a dateless guest is allowed as Pending. Keep data
    // clean by requiring date and time together (or neither).
    if (hasDate !== hasTime) {
      return setError('Add both a date and a time, or leave both blank to save as Pending.');
    }
    persist('', '');
  }

  return (
    <Dialog open={guestModal.open} onOpenChange={(o) => !o && closeGuestModal()}>
      <DialogContent
        className="max-w-[560px] bg-white text-mx-title"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[20px] font-bold text-mx-title">
            {editing ? 'Edit Guest' : 'Add Guest'}
          </DialogTitle>
          <DialogDescription className="text-[13.5px] text-mx-secondary">
            {editing
              ? 'Update guest details — changes save and sync to the team.'
              : requireDate
                ? 'A date + time are needed to place this guest on the schedule.'
                : 'New guests start as Pending until confirmed. Leave the date blank to save as Pending.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Full Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Doe" className="bg-white" />
          </Field>
          <Field label="Email" className="col-span-2">
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className="bg-white" />
          </Field>
          <Field label="Recording date" required={requireDate}>
            <Input type="date" value={form.recordingDate} onChange={(e) => set('recordingDate', e.target.value)} className="bg-white" />
          </Field>
          <Field label="Recording time" required={requireDate}>
            <Input type="time" value={form.recordingTime} onChange={(e) => set('recordingTime', e.target.value)} className="bg-white" />
          </Field>
          <Field label="Duration (min)">
            <Input type="number" value={form.duration} onChange={(e) => set('duration', e.target.value)} className="bg-white" />
          </Field>
          <Field label="Episode #">
            <Input type="number" value={form.episode} onChange={(e) => set('episode', e.target.value)} placeholder="110" className="bg-white" />
          </Field>
          <Field label="Recording location" className="col-span-2">
            <div className="flex gap-2">
              {(
                [
                  { id: 'nashville', label: 'Nashville' },
                  { id: 'away', label: 'Away' }
                ] as { id: LocationKind; label: string }[]
              ).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => set('location', loc.id)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-[13px] font-bold transition-colors',
                    form.location === loc.id
                      ? 'border-mx-blue bg-[rgba(67,128,243,0.08)] text-mx-blueDeep'
                      : 'border-mx-field text-mx-secondary hover:border-mx-fieldHover'
                  )}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Context, intro source, topics…" className="min-h-[72px] bg-white" />
          </Field>
        </div>

        {error && !pendingPrompt && (
          <p className="mt-4 text-[12.5px] font-semibold text-mx-red">{error}</p>
        )}

        {pendingPrompt ? (
          <div className="mt-5 rounded-xl border border-mx-line bg-mx-lineSoft/60 p-4">
            <p className="text-[13px] font-bold text-mx-title">No date &amp; time set</p>
            <p className="mt-1 text-[12.5px] text-mx-secondary">
              This guest can’t be placed on the schedule without a recording date and time.
              You can keep editing, save them to Bookings as Pending, or discard.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={closeGuestModal}
                className="h-[38px] rounded-lg px-4 font-bold text-mx-body"
              >
                Discard
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPendingPrompt(false)}
                className="h-[38px] rounded-lg border border-mx-field px-4 font-bold text-mx-body"
              >
                Keep editing
              </Button>
              <Button
                onClick={() => persist('', '')}
                className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep"
              >
                Save as Pending
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter className="mt-6 gap-2">
            <Button variant="ghost" onClick={closeGuestModal} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">
              Cancel
            </Button>
            <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">
              {editing ? 'Save changes' : 'Add Guest'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  className,
  children
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-bold text-mx-title">
        {label}
        {required && <span className="text-mx-red"> *</span>}
      </span>
      {children}
    </label>
  );
}
