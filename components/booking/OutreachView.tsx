'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@matthewsreis/ui/select';
import { cn } from '@/lib/utils';
import { StatusPill, Avatar } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import { dateOnly, type OutreachResponse, type OutreachRow } from '@/lib/demo/booking-fixtures';

const RESPONSE_META: Record<OutreachResponse, { label: string; tone: 'grey' | 'green' | 'amber' }> = {
  no_response: { label: 'No response', tone: 'grey' },
  responded: { label: 'Responded', tone: 'green' },
  passed: { label: 'Passed', tone: 'amber' }
};

/** Blank when there's no date (or an unparseable one) — no more "Jan 1, 1900". */
function reachedLabel(iso: string): string {
  if (!iso) return '';
  const d = dateOnly(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function OutreachView() {
  const { data } = useBooking();
  const [sortAsc, setSortAsc] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const editing = editId ? data.outreach.find((o) => o.id === editId) ?? null : null;

  const rows = useMemo(
    () =>
      [...data.outreach].sort((a, b) => {
        const ta = a.reachedOut ? dateOnly(a.reachedOut).getTime() : 0;
        const tb = b.reachedOut ? dateOnly(b.reachedOut).getTime() : 0;
        return sortAsc ? ta - tb : tb - ta;
      }),
    [data.outreach, sortAsc]
  );

  return (
    <div className="px-12 py-8">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-mx-secondary">{rows.length} contacts</span>
        <Button onClick={() => setAddOpen(true)} className="h-[38px] gap-2 rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">
          <Plus size={16} /> Add Contact
        </Button>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-mx-line bg-white shadow-card">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-mx-line bg-mx-lineSoft text-[11.5px] font-bold uppercase tracking-wide text-mx-label">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Business</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">
                <button onClick={() => setSortAsc((v) => !v)} className="inline-flex items-center gap-1.5 hover:text-mx-secondary">
                  Date reached out <ArrowUpDown size={12} />
                </button>
              </th>
              <th className="px-5 py-3">Response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const meta = RESPONSE_META[o.response];
              return (
                <tr
                  key={o.id}
                  onClick={() => setEditId(o.id)}
                  className="cursor-pointer border-b border-mx-line transition-colors last:border-b-0 hover:bg-mx-lineSoft/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={o.name} className="h-9 w-9 shrink-0" />
                      <div className="text-[14px] font-bold text-mx-title">{o.name}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] text-mx-body">{o.business}</td>
                  <td className="px-5 py-3.5 text-[13px] text-mx-link">{o.contact}</td>
                  <td className="px-5 py-3.5 text-[13px] text-mx-body">{reachedLabel(o.reachedOut)}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill tone={meta.tone} dot>{meta.label}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ContactModal
        open={addOpen || !!editing}
        contact={editing}
        onClose={() => {
          setAddOpen(false);
          setEditId(null);
        }}
      />
    </div>
  );
}

function ContactModal({
  open,
  contact,
  onClose
}: {
  open: boolean;
  contact: OutreachRow | null;
  onClose: () => void;
}) {
  const { addOutreach, updateOutreach, removeOutreach } = useBooking();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [business, setBusiness] = useState('');
  const [contactField, setContactField] = useState('');
  const [reachedOut, setReachedOut] = useState('');
  const [response, setResponse] = useState<OutreachResponse>('no_response');

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? '');
    setNote(contact?.note ?? '');
    setBusiness(contact?.business ?? '');
    setContactField(contact?.contact ?? '');
    setReachedOut(contact?.reachedOut ?? '');
    setResponse(contact?.response ?? 'no_response');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  function submit() {
    const payload = {
      name: name.trim() || 'New Contact',
      note: note.trim() || undefined,
      business: business.trim(),
      contact: contactField.trim(),
      reachedOut,
      response
    };
    if (contact) updateOutreach(contact.id, payload);
    else addOutreach(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[520px] bg-white text-mx-title"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[19px] font-bold">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-mx-secondary">
            Update status, dates, and notes — changes save and sync to the team.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2"><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" /></Field>
          <Field label="Business"><Input value={business} onChange={(e) => setBusiness(e.target.value)} className="bg-white" /></Field>
          <Field label="Contact"><Input value={contactField} onChange={(e) => setContactField(e.target.value)} placeholder="email / phone" className="bg-white" /></Field>
          <Field label="Date reached out"><Input type="date" value={reachedOut} onChange={(e) => setReachedOut(e.target.value)} className="bg-white" /></Field>
          <Field label="Response">
            <Select value={response} onValueChange={(v) => setResponse(v as OutreachResponse)}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_response">No response</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context, intro source, background…"
              className="min-h-[120px] bg-white"
            />
          </Field>
        </div>
        <DialogFooter className="mt-5 gap-2 sm:justify-between">
          {contact ? (
            <Button
              variant="ghost"
              onClick={() => {
                removeOutreach(contact.id);
                onClose();
              }}
              className="h-[38px] gap-1.5 rounded-lg px-3 font-bold text-mx-red hover:bg-mx-redBg"
            >
              <Trash2 size={14} /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
            <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">
              {contact ? 'Save' : 'Add Contact'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] font-bold text-mx-title">{label}</span>
      {children}
    </label>
  );
}
