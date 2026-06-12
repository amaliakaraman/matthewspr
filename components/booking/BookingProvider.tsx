'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  seedData,
  type BookingData,
  type Guest,
  type TaskId,
  type AvailabilityBlock,
  type TravelRange,
  type OutreachRow,
  type EmailScript,
  type VideoClip
} from '@/lib/demo/booking-fixtures';
import { GuestModal } from './GuestModal';

const STORAGE_KEY = 'mx-booking-v1';

function uid(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

interface GuestModalState {
  open: boolean;
  editId?: string;
}

interface BookingContextValue {
  data: BookingData;
  hydrated: boolean;
  // guest mutations
  addGuest: (g: Guest) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  toggleTask: (id: string, task: TaskId) => void;
  setTaskField: (id: string, key: string, value: string) => void;
  setConfirmed: (id: string, confirmed: boolean) => void;
  setPendingReason: (id: string, reason: string, other?: string) => void;
  // availability / travel
  addAvailability: (b: Omit<AvailabilityBlock, 'id'>) => void;
  addTravel: (t: Omit<TravelRange, 'id'>) => void;
  // outreach / scripts / content
  addOutreach: (o: Omit<OutreachRow, 'id'>) => void;
  addScript: (s: Omit<EmailScript, 'id'>) => void;
  updateScript: (id: string, patch: Partial<EmailScript>) => void;
  addClip: (c: Omit<VideoClip, 'id'>) => void;
  toggleClip: (id: string, field: 'edited' | 'posted') => void;
  addIgIdea: (text: string) => void;
  addPodcastIdea: (text: string) => void;
  // guest modal
  openAddGuest: () => void;
  openEditGuest: (id: string) => void;
  closeGuestModal: () => void;
  guestModal: GuestModalState;
  // io
  exportData: () => void;
  importData: (file: File) => Promise<void>;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within <BookingProvider>');
  return ctx;
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BookingData>(() => seedData());
  const [hydrated, setHydrated] = useState(false);
  const [guestModal, setGuestModal] = useState<GuestModalState>({ open: false });
  const firstWrite = useRef(true);

  // Hydrate from localStorage after mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BookingData>;
        setData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* corrupt store — fall back to seed */
    }
    setHydrated(true);
  }, []);

  // Persist on change (skip the very first run before hydration completes).
  useEffect(() => {
    if (!hydrated) return;
    if (firstWrite.current) {
      firstWrite.current = false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / unavailable */
    }
  }, [data, hydrated]);

  const patchGuest = useCallback((id: string, fn: (g: Guest) => Guest) => {
    setData((d) => ({
      ...d,
      guests: d.guests.map((g) => (g.id === id ? fn(g) : g))
    }));
  }, []);

  const value = useMemo<BookingContextValue>(
    () => ({
      data,
      hydrated,
      addGuest: (g) => setData((d) => ({ ...d, guests: [...d.guests, g] })),
      updateGuest: (id, patch) => patchGuest(id, (g) => ({ ...g, ...patch })),
      removeGuest: (id) =>
        setData((d) => ({ ...d, guests: d.guests.filter((g) => g.id !== id) })),
      toggleTask: (id, task) =>
        patchGuest(id, (g) => ({
          ...g,
          done: g.done.includes(task)
            ? g.done.filter((t) => t !== task)
            : [...g.done, task]
        })),
      setTaskField: (id, key, val) =>
        patchGuest(id, (g) => ({ ...g, fields: { ...g.fields, [key]: val } })),
      setConfirmed: (id, confirmed) => patchGuest(id, (g) => ({ ...g, confirmed })),
      setPendingReason: (id, reason, other) =>
        patchGuest(id, (g) => ({ ...g, pendingReason: reason, pendingReasonOther: other })),
      addAvailability: (b) =>
        setData((d) => ({ ...d, availability: [...d.availability, { ...b, id: uid('a') }] })),
      addTravel: (t) =>
        setData((d) => ({ ...d, travel: [...d.travel, { ...t, id: uid('t') }] })),
      addOutreach: (o) =>
        setData((d) => ({ ...d, outreach: [{ ...o, id: uid('o') }, ...d.outreach] })),
      addScript: (s) =>
        setData((d) => ({ ...d, scripts: [...d.scripts, { ...s, id: uid('s') }] })),
      updateScript: (id, patch) =>
        setData((d) => ({
          ...d,
          scripts: d.scripts.map((s) => (s.id === id ? { ...s, ...patch } : s))
        })),
      addClip: (c) =>
        setData((d) => ({ ...d, clips: [...d.clips, { ...c, id: uid('c') }] })),
      toggleClip: (id, field) =>
        setData((d) => ({
          ...d,
          clips: d.clips.map((c) => (c.id === id ? { ...c, [field]: !c[field] } : c))
        })),
      addIgIdea: (text) =>
        setData((d) => ({ ...d, igIdeas: [...d.igIdeas, { id: uid('ig'), text }] })),
      addPodcastIdea: (text) =>
        setData((d) => ({ ...d, podcastIdeas: [...d.podcastIdeas, { id: uid('p'), text }] })),
      openAddGuest: () => setGuestModal({ open: true }),
      openEditGuest: (id) => setGuestModal({ open: true, editId: id }),
      closeGuestModal: () => setGuestModal({ open: false }),
      guestModal,
      exportData: () => {
        try {
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `matthews-booking-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      },
      importData: async (file) => {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<BookingData>;
        setData((prev) => ({ ...prev, ...parsed }));
      }
    }),
    [data, hydrated, guestModal, patchGuest]
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
      <GuestModal />
    </BookingContext.Provider>
  );
}
