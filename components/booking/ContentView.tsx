'use client';

import { useState } from 'react';
import { Plus, Film, Camera, Mic, Check } from 'lucide-react';
import { Button } from '@matthewsreis/ui/button';
import { Input } from '@matthewsreis/ui/input';
import { Checkbox } from '@matthewsreis/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@matthewsreis/ui/dialog';
import { SectionLabel, StatCard, StatusPill } from '@/components/shell/primitives';
import { useBooking } from './BookingProvider';
import { dateOnly } from '@/lib/demo/booking-fixtures';

export function ContentView() {
  const { data, toggleClip, addIgIdea, addPodcastIdea } = useBooking();
  const [clipOpen, setClipOpen] = useState(false);
  const [igText, setIgText] = useState('');
  const [podText, setPodText] = useState('');

  const posted = data.clips.filter((c) => c.posted).length;

  return (
    <div className="px-12 py-8">
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Film size={20} />} value={data.clips.length} label="KM video clips" />
        <StatCard icon={<Check size={20} />} iconClass="bg-mx-greenBg text-mx-green" value={posted} label="Posted" />
        <StatCard icon={<Camera size={20} />} iconClass="bg-[#FCE7F0] text-[#E1306C]" value={data.igIdeas.length} label="IG post ideas" />
        <StatCard icon={<Mic size={20} />} value={data.podcastIdeas.length} label="Podcast ideas" />
      </div>

      {/* KM Video Clips */}
      <div className="mb-6 rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
        <SectionLabel right={
          <Button onClick={() => setClipOpen(true)} className="h-8 gap-1.5 rounded-lg bg-mx-blue px-3 text-[12px] font-bold text-white hover:bg-mx-blueDeep">
            <Plus size={14} /> Add Clip
          </Button>
        }>
          KM Video Clips
        </SectionLabel>
        <div className="overflow-hidden rounded-xl border border-mx-line">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-mx-line bg-mx-lineSoft text-[11.5px] font-bold uppercase tracking-wide text-mx-label">
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Drive #</th>
                <th className="px-4 py-2.5 text-center">Edited</th>
                <th className="px-4 py-2.5 text-center">Posted</th>
              </tr>
            </thead>
            <tbody>
              {data.clips.map((c) => (
                <tr key={c.id} className="border-b border-mx-line last:border-b-0">
                  <td className="px-4 py-3 text-[13.5px] font-semibold text-mx-title">{c.title}</td>
                  <td className="px-4 py-3 text-[13px] text-mx-body">
                    {dateOnly(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-mx-secondary">{c.driveNumber}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Checkbox checked={c.edited} onCheckedChange={() => toggleClip(c.id, 'edited')} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Checkbox checked={c.posted} onCheckedChange={() => toggleClip(c.id, 'posted')} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <IdeaList
          title="IG Post Ideas"
          icon={<Camera size={15} className="text-[#E1306C]" />}
          ideas={data.igIdeas}
          value={igText}
          onChange={setIgText}
          onAdd={() => {
            if (igText.trim()) addIgIdea(igText.trim());
            setIgText('');
          }}
        />
        <IdeaList
          title="Podcast Ideas"
          icon={<Mic size={15} className="text-mx-blue" />}
          ideas={data.podcastIdeas}
          value={podText}
          onChange={setPodText}
          onAdd={() => {
            if (podText.trim()) addPodcastIdea(podText.trim());
            setPodText('');
          }}
        />
      </div>

      <AddClipModal open={clipOpen} onClose={() => setClipOpen(false)} />
    </div>
  );
}

function IdeaList({
  title,
  icon,
  ideas,
  value,
  onChange,
  onAdd
}: {
  title: string;
  icon: React.ReactNode;
  ideas: { id: string; text: string }[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-mx-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 border-b border-mx-line pb-3">
        {icon}
        <span className="text-[14px] font-bold text-mx-title">{title}</span>
        <StatusPill tone="grey" className="ml-auto">{ideas.length}</StatusPill>
      </div>
      <div className="mb-3 flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="Add an idea…"
          className="bg-white"
        />
        <Button onClick={onAdd} className="h-[38px] shrink-0 gap-1.5 rounded-lg bg-mx-blue px-3.5 font-bold text-white hover:bg-mx-blueDeep">
          <Plus size={15} /> Add
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {ideas.map((i) => (
          <li key={i.id} className="rounded-xl border border-mx-line bg-white px-3.5 py-2.5 text-[13.5px] text-mx-body">
            {i.text}
          </li>
        ))}
        {ideas.length === 0 && <li className="py-2 text-center text-[13px] text-mx-muted">No ideas yet.</li>}
      </ul>
    </div>
  );
}

function AddClipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addClip } = useBooking();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [driveNumber, setDriveNumber] = useState('');

  function submit() {
    addClip({
      title: title.trim() || 'Untitled clip',
      date: date || new Date().toISOString().slice(0, 10),
      driveNumber: driveNumber.trim() || 'KM-0000',
      edited: false,
      posted: false
    });
    setTitle(''); setDate(''); setDriveNumber('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] bg-white text-mx-title">
        <DialogHeader>
          <DialogTitle className="text-[19px] font-bold">Add Video Clip</DialogTitle>
        </DialogHeader>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-mx-title">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-mx-title">Date</span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-mx-title">Drive #</span>
              <Input value={driveNumber} onChange={(e) => setDriveNumber(e.target.value)} placeholder="KM-0315" className="bg-white" />
            </label>
          </div>
        </div>
        <DialogFooter className="mt-5 gap-2">
          <Button variant="ghost" onClick={onClose} className="h-[38px] rounded-lg px-4 font-bold text-mx-body">Cancel</Button>
          <Button onClick={submit} className="h-[38px] rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep">Add Clip</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
