'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Plus, Upload, Download } from 'lucide-react';
import { Button } from '@matthewsreis/ui/button';
import { useBooking } from './BookingProvider';

export function HeaderActions() {
  const { openAddGuest, exportData, importData } = useBooking();
  const fileRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  // On the Schedule page a guest needs a date + time to be placed on the
  // calendar; everywhere else a dateless Pending guest is allowed.
  const requireDate = pathname?.startsWith('/schedule') ?? false;

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importData(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-mx-field bg-white px-3.5 text-[13px] font-bold text-mx-body transition-colors hover:border-mx-fieldHover"
        title="Import booking data (JSON)"
      >
        <Upload size={15} /> Import
      </button>
      <button
        onClick={exportData}
        className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-mx-field bg-white px-3.5 text-[13px] font-bold text-mx-body transition-colors hover:border-mx-fieldHover"
        title="Export booking data (JSON)"
      >
        <Download size={15} /> Export
      </button>
      <Button
        onClick={() => openAddGuest({ requireDate })}
        className="h-[38px] gap-2 rounded-lg bg-mx-blue px-[18px] font-bold text-white hover:bg-mx-blueDeep"
      >
        <Plus size={16} /> Add Guest
      </Button>
    </div>
  );
}
