'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  ExternalLink,
  Phone,
  Mail,
  FileText
} from 'lucide-react';
import { Button } from '@matthewsreis/ui/button';
import { Input } from '@matthewsreis/ui/input';
import { Textarea } from '@matthewsreis/ui/textarea';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@matthewsreis/ui/tabs';
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
import { StatusPill, SectionLabel } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import {
  SCRIPT_CATEGORIES,
  KEY_LINKS,
  CONRAD_CONTACTS,
  INVITE_TEMPLATES,
  type EmailScript,
  type ScriptCategory
} from '@/lib/demo/booking-fixtures';

export function LibraryView() {
  const { data } = useBooking();
  const [editing, setEditing] = useState<EmailScript | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="px-12 py-8">
      <Tabs defaultValue="scripts">
        <TabsList className="mb-6">
          <TabsTrigger value="scripts">Email Scripts</TabsTrigger>
          <TabsTrigger value="pr">PR Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="scripts">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-mx-secondary">{data.scripts.length} templates</span>
            <Button onClick={() => setAdding(true)} className="h-[38px] gap-2 rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">
              <Plus size={16} /> Add Script
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.scripts.map((s) => (
              <ScriptCard key={s.id} script={s} onEdit={() => setEditing(s)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pr">
          <PRResources />
        </TabsContent>
      </Tabs>

      <ScriptModal
        open={adding || !!editing}
        script={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ScriptCard({ script, onEdit }: { script: EmailScript; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${script.subject}\n\n${script.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-col rounded-[16px] border border-mx-line bg-white p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-mx-title">{script.title}</h3>
        <StatusPill tone="blue" className="shrink-0">{script.category}</StatusPill>
      </div>
      <p className="text-[12.5px] font-semibold text-mx-secondary">{script.subject}</p>
      <p className={cn('mt-2 whitespace-pre-line text-[13px] leading-relaxed text-mx-body', !expanded && 'line-clamp-3')}>
        {script.body}
      </p>
      <div className="mt-3.5 flex items-center gap-2 border-t border-mx-line pt-3">
        <button onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mx-field bg-white px-2.5 text-[12px] font-bold text-mx-body hover:border-mx-fieldHover">
          {copied ? <Check size={13} className="text-mx-green" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mx-field bg-white px-2.5 text-[12px] font-bold text-mx-body hover:border-mx-fieldHover">
          <ChevronDown size={13} className={cn('transition-transform', expanded && 'rotate-180')} /> {expanded ? 'Collapse' : 'Expand'}
        </button>
        <button onClick={onEdit} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-mx-link hover:bg-mx-lineSoft">
          <Pencil size={13} /> Edit
        </button>
      </div>
    </div>
  );
}

function ScriptModal({ open, script, onClose }: { open: boolean; script: EmailScript | null; onClose: () => void }) {
  const { addScript, updateScript } = useBooking();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ScriptCategory>('Outreach');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(script?.title ?? '');
    setCategory(script?.category ?? 'Outreach');
    setSubject(script?.subject ?? '');
    setBody(script?.body ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, script?.id]);

  function submit() {
    if (!title.trim()) return setError('Please enter a title.');
    const payload = { title: title.trim(), category, subject: subject.trim(), body: body.trim() };
    if (script) updateScript(script.id, payload);
    else addScript(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[560px] bg-white text-mx-title"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle className="text-[19px] font-bold">{script ? 'Edit Script' : 'Add Script'}</DialogTitle>
        </DialogHeader>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-mx-title">Title</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-mx-title">Category</span>
              <Select value={category} onValueChange={(v) => setCategory(v as ScriptCategory)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCRIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-mx-title">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-white" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-mx-title">Body</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[160px] bg-white" />
          </label>
        </div>
        {error && <p className="mt-4 text-[12.5px] font-semibold text-mx-red">{error}</p>}
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={onClose} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
          <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">{script ? 'Save' : 'Add Script'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PRResources() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
        <SectionLabel>Key Links &amp; Resources</SectionLabel>
        <div className="flex flex-col gap-2">
          {KEY_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="flex items-start gap-3 rounded-xl border border-mx-line bg-white px-3.5 py-3 transition-colors hover:border-mx-fieldHover">
              <ExternalLink size={15} className="mt-0.5 text-mx-blue" />
              <div>
                <div className="text-[14px] font-bold text-mx-title">{l.label}</div>
                <div className="text-[12.5px] text-mx-secondary">{l.description}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
        <SectionLabel>Conrad Hotel Contacts</SectionLabel>
        <div className="flex flex-col gap-2">
          {CONRAD_CONTACTS.map((c) => (
            <div key={c.name} className="rounded-xl border border-mx-line bg-white px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-mx-title">{c.name}</span>
                <StatusPill tone="grey">{c.role}</StatusPill>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-4 text-[12.5px] text-mx-body">
                <span className="inline-flex items-center gap-1.5"><Phone size={12} className="text-mx-muted" /> {c.phone}</span>
                <span className="inline-flex items-center gap-1.5 text-mx-link"><Mail size={12} /> {c.email}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[16px] border border-mx-line bg-white p-5 shadow-card xl:col-span-2">
        <SectionLabel>Travel / Calendar Invite Templates</SectionLabel>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {INVITE_TEMPLATES.map((t) => (
            <a key={t.label} href={t.href} className="flex items-start gap-3 rounded-xl border border-mx-line bg-white px-3.5 py-3 transition-colors hover:border-mx-fieldHover">
              <FileText size={15} className="mt-0.5 text-mx-teal" />
              <div>
                <div className="text-[13.5px] font-bold text-mx-title">{t.label}</div>
                <div className="text-[12px] text-mx-secondary">{t.description}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
