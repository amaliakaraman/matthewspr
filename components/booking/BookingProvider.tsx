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
  type BookingData,
  type Guest,
  type TaskId,
  type AvailabilityBlock,
  type AvailabilityKind,
  type TravelRange,
  type OutreachRow,
  type OutreachResponse,
  type EmailScript,
  type ScriptCategory,
  type VideoClip,
  type Idea,
  type LocationKind
} from '@/lib/demo/booking-fixtures';
import type {
  BookingGuestRow,
  KyleAvailabilityRow,
  KyleTravelRow,
  OutreachContactRow,
  EmailScriptRow,
  VideoClipRow,
  ContentIdeaRow
} from '@/lib/supabase/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { GuestModal } from './GuestModal';

function uid(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

const EMPTY_DATA: BookingData = {
  guests: [],
  availability: [],
  travel: [],
  outreach: [],
  scripts: [],
  clips: [],
  igIdeas: [],
  podcastIdeas: []
};

/* ── Row ↔ app mappers ──────────────────────────────────────────────────────
   Supabase rows are flat/snake_case; the app's pure logic + UI run on the
   existing camelCase shapes. Guests fan their `tasks` jsonb out to `done`/
   `fields` on read, and rebuild it on write. */

function rowToGuest(r: BookingGuestRow): Guest {
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    episode: r.episode ?? undefined,
    recordingDate: r.recording_date ?? '',
    recordingTime: r.recording_time ?? '',
    duration: r.duration ?? 90,
    location: (r.location === 'away' ? 'away' : 'nashville') as LocationKind,
    notes: r.notes ?? undefined,
    confirmed: r.confirmed,
    pendingReason: r.pending_reason ?? undefined,
    pendingReasonOther: r.pending_reason_other ?? undefined,
    done: (r.tasks?.done ?? []) as TaskId[],
    fields: r.tasks?.fields ?? {}
  };
}

function guestToRow(g: Guest): Partial<BookingGuestRow> {
  return {
    id: g.id,
    name: g.name,
    email: g.email ?? null,
    episode: g.episode ?? null,
    recording_date: g.recordingDate || null,
    recording_time: g.recordingTime || null,
    duration: g.duration ?? null,
    location: g.location ?? null,
    notes: g.notes ?? null,
    confirmed: g.confirmed,
    pending_reason: g.pendingReason ?? null,
    pending_reason_other: g.pendingReasonOther ?? null,
    tasks: { done: g.done, fields: g.fields }
  };
}

function rowToAvailability(r: KyleAvailabilityRow): AvailabilityBlock {
  return {
    id: r.id,
    date: r.date ?? '',
    from: r.from_time ?? '',
    until: r.until_time ?? '',
    kind: (r.kind as AvailabilityKind) ?? 'all_day',
    note: r.note ?? undefined
  };
}

function availabilityToRow(b: AvailabilityBlock): Partial<KyleAvailabilityRow> {
  return {
    id: b.id,
    date: b.date || null,
    from_time: b.from || null,
    until_time: b.until || null,
    kind: b.kind ?? null,
    note: b.note ?? null
  };
}

function rowToTravel(r: KyleTravelRow): TravelRange {
  return {
    id: r.id,
    destination: r.destination ?? '',
    color: r.color ?? '#6563EE',
    start: r.start_date ?? '',
    end: r.end_date ?? ''
  };
}

function travelToRow(t: TravelRange): Partial<KyleTravelRow> {
  return {
    id: t.id,
    destination: t.destination || null,
    color: t.color || null,
    start_date: t.start || null,
    end_date: t.end || null
  };
}

function rowToOutreach(r: OutreachContactRow): OutreachRow {
  return {
    id: r.id,
    name: r.name ?? '',
    note: r.note ?? undefined,
    business: r.business ?? '',
    contact: r.contact ?? '',
    reachedOut: r.reached_out ?? '',
    response: (r.response as OutreachResponse) ?? 'no_response'
  };
}

function outreachToRow(o: OutreachRow): Partial<OutreachContactRow> {
  return {
    id: o.id,
    name: o.name || null,
    note: o.note ?? null,
    business: o.business || null,
    contact: o.contact || null,
    reached_out: o.reachedOut || null,
    response: o.response ?? null
  };
}

function rowToScript(r: EmailScriptRow): EmailScript {
  return {
    id: r.id,
    title: r.title ?? '',
    category: (r.category as ScriptCategory) ?? 'Other',
    subject: '',
    body: r.body ?? ''
  };
}

function scriptToRow(s: EmailScript): Partial<EmailScriptRow> {
  return {
    id: s.id,
    title: s.title || null,
    category: s.category ?? null,
    body: s.body ?? null
  };
}

function rowToClip(r: VideoClipRow): VideoClip {
  return {
    id: r.id,
    title: r.title ?? '',
    date: r.date ?? '',
    driveNumber: r.drive ?? '',
    edited: !!r.edited,
    posted: !!r.posted
  };
}

function clipToRow(c: VideoClip): Partial<VideoClipRow> {
  return {
    id: c.id,
    title: c.title || null,
    date: c.date || null,
    drive: c.driveNumber || null,
    edited: c.edited,
    posted: c.posted
  };
}

function rowToIdea(r: ContentIdeaRow): Idea {
  return { id: r.id, text: r.text ?? '' };
}

/* ── Context ──────────────────────────────────────────────────────────────── */

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
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [data, setData] = useState<BookingData>(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [guestModal, setGuestModal] = useState<GuestModalState>({ open: false });

  // Always-current snapshot so mutations can compute the next row without
  // chaining setState side-effects.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  /* ── Per-table fetchers (used on load + realtime change) ────────────────── */

  const refetchGuests = useCallback(async () => {
    const { data: rows } = await supabase.from('booking_guests').select('*');
    if (rows) setData((d) => ({ ...d, guests: rows.map(rowToGuest) }));
  }, [supabase]);

  const refetchAvailability = useCallback(async () => {
    const { data: rows } = await supabase.from('kyle_availability').select('*');
    if (rows) setData((d) => ({ ...d, availability: rows.map(rowToAvailability) }));
  }, [supabase]);

  const refetchTravel = useCallback(async () => {
    const { data: rows } = await supabase.from('kyle_travel').select('*');
    if (rows) setData((d) => ({ ...d, travel: rows.map(rowToTravel) }));
  }, [supabase]);

  const refetchOutreach = useCallback(async () => {
    const { data: rows } = await supabase.from('outreach_contacts').select('*');
    if (rows) setData((d) => ({ ...d, outreach: rows.map(rowToOutreach) }));
  }, [supabase]);

  const refetchScripts = useCallback(async () => {
    const { data: rows } = await supabase.from('email_scripts').select('*');
    if (rows) setData((d) => ({ ...d, scripts: rows.map(rowToScript) }));
  }, [supabase]);

  const refetchClips = useCallback(async () => {
    const { data: rows } = await supabase.from('video_clips').select('*');
    if (rows) setData((d) => ({ ...d, clips: rows.map(rowToClip) }));
  }, [supabase]);

  const refetchIdeas = useCallback(async () => {
    const { data: rows } = await supabase.from('content_ideas').select('*');
    if (rows) {
      setData((d) => ({
        ...d,
        igIdeas: rows.filter((r) => r.kind === 'ig').map(rowToIdea),
        podcastIdeas: rows.filter((r) => r.kind === 'podcast').map(rowToIdea)
      }));
    }
  }, [supabase]);

  /* ── Initial load + realtime subscriptions ─────────────────────────────── */

  useEffect(() => {
    let active = true;

    (async () => {
      const [guests, availability, travel, outreach, scripts, clips, ideas] =
        await Promise.all([
          supabase.from('booking_guests').select('*'),
          supabase.from('kyle_availability').select('*'),
          supabase.from('kyle_travel').select('*'),
          supabase.from('outreach_contacts').select('*'),
          supabase.from('email_scripts').select('*'),
          supabase.from('video_clips').select('*'),
          supabase.from('content_ideas').select('*')
        ]);

      if (!active) return;

      const ideaRows = ideas.data ?? [];
      setData({
        guests: (guests.data ?? []).map(rowToGuest),
        availability: (availability.data ?? []).map(rowToAvailability),
        travel: (travel.data ?? []).map(rowToTravel),
        outreach: (outreach.data ?? []).map(rowToOutreach),
        scripts: (scripts.data ?? []).map(rowToScript),
        clips: (clips.data ?? []).map(rowToClip),
        igIdeas: ideaRows.filter((r) => r.kind === 'ig').map(rowToIdea),
        podcastIdeas: ideaRows.filter((r) => r.kind === 'podcast').map(rowToIdea)
      });
      setHydrated(true);
    })();

    const channel = supabase
      .channel('booking-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_guests' }, () => {
        void refetchGuests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyle_availability' }, () => {
        void refetchAvailability();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyle_travel' }, () => {
        void refetchTravel();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_contacts' }, () => {
        void refetchOutreach();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_scripts' }, () => {
        void refetchScripts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_clips' }, () => {
        void refetchClips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_ideas' }, () => {
        void refetchIdeas();
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [
    supabase,
    refetchGuests,
    refetchAvailability,
    refetchTravel,
    refetchOutreach,
    refetchScripts,
    refetchClips,
    refetchIdeas
  ]);

  /* ── Write helpers (optimistic local update + targeted upsert/delete) ───── */

  const saveGuest = useCallback(
    (g: Guest) => {
      void supabase.from('booking_guests').upsert(guestToRow(g), { onConflict: 'id' });
    },
    [supabase]
  );

  const patchGuestAndSave = useCallback(
    (id: string, fn: (g: Guest) => Guest) => {
      const current = dataRef.current.guests.find((g) => g.id === id);
      if (!current) return;
      const updated = fn(current);
      setData((d) => ({
        ...d,
        guests: d.guests.map((g) => (g.id === id ? updated : g))
      }));
      saveGuest(updated);
    },
    [saveGuest]
  );

  const value = useMemo<BookingContextValue>(
    () => ({
      data,
      hydrated,

      addGuest: (g) => {
        setData((d) => ({ ...d, guests: [...d.guests, g] }));
        saveGuest(g);
      },
      updateGuest: (id, patch) => patchGuestAndSave(id, (g) => ({ ...g, ...patch })),
      removeGuest: (id) => {
        setData((d) => ({ ...d, guests: d.guests.filter((g) => g.id !== id) }));
        void supabase.from('booking_guests').delete().eq('id', id);
      },
      toggleTask: (id, task) =>
        patchGuestAndSave(id, (g) => ({
          ...g,
          done: g.done.includes(task)
            ? g.done.filter((t) => t !== task)
            : [...g.done, task]
        })),
      setTaskField: (id, key, val) =>
        patchGuestAndSave(id, (g) => ({ ...g, fields: { ...g.fields, [key]: val } })),
      setConfirmed: (id, confirmed) => patchGuestAndSave(id, (g) => ({ ...g, confirmed })),
      setPendingReason: (id, reason, other) =>
        patchGuestAndSave(id, (g) => ({
          ...g,
          pendingReason: reason,
          pendingReasonOther: other
        })),

      addAvailability: (b) => {
        const block: AvailabilityBlock = { ...b, id: uid('a') };
        setData((d) => ({ ...d, availability: [...d.availability, block] }));
        void supabase.from('kyle_availability').upsert(availabilityToRow(block), { onConflict: 'id' });
      },
      addTravel: (t) => {
        const range: TravelRange = { ...t, id: uid('t') };
        setData((d) => ({ ...d, travel: [...d.travel, range] }));
        void supabase.from('kyle_travel').upsert(travelToRow(range), { onConflict: 'id' });
      },

      addOutreach: (o) => {
        const row: OutreachRow = { ...o, id: uid('o') };
        setData((d) => ({ ...d, outreach: [row, ...d.outreach] }));
        void supabase.from('outreach_contacts').upsert(outreachToRow(row), { onConflict: 'id' });
      },
      addScript: (s) => {
        const script: EmailScript = { ...s, id: uid('s') };
        setData((d) => ({ ...d, scripts: [...d.scripts, script] }));
        void supabase.from('email_scripts').upsert(scriptToRow(script), { onConflict: 'id' });
      },
      updateScript: (id, patch) => {
        const current = dataRef.current.scripts.find((s) => s.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setData((d) => ({
          ...d,
          scripts: d.scripts.map((s) => (s.id === id ? updated : s))
        }));
        void supabase.from('email_scripts').upsert(scriptToRow(updated), { onConflict: 'id' });
      },
      addClip: (c) => {
        const clip: VideoClip = { ...c, id: uid('c') };
        setData((d) => ({ ...d, clips: [...d.clips, clip] }));
        void supabase.from('video_clips').upsert(clipToRow(clip), { onConflict: 'id' });
      },
      toggleClip: (id, field) => {
        const current = dataRef.current.clips.find((c) => c.id === id);
        if (!current) return;
        const updated = { ...current, [field]: !current[field] };
        setData((d) => ({
          ...d,
          clips: d.clips.map((c) => (c.id === id ? updated : c))
        }));
        void supabase.from('video_clips').upsert(clipToRow(updated), { onConflict: 'id' });
      },
      addIgIdea: (text) => {
        const idea: Idea = { id: uid('ig'), text };
        setData((d) => ({ ...d, igIdeas: [...d.igIdeas, idea] }));
        void supabase
          .from('content_ideas')
          .upsert({ id: idea.id, kind: 'ig', text, color: null }, { onConflict: 'id' });
      },
      addPodcastIdea: (text) => {
        const idea: Idea = { id: uid('p'), text };
        setData((d) => ({ ...d, podcastIdeas: [...d.podcastIdeas, idea] }));
        void supabase
          .from('content_ideas')
          .upsert({ id: idea.id, kind: 'podcast', text, color: null }, { onConflict: 'id' });
      },

      openAddGuest: () => setGuestModal({ open: true }),
      openEditGuest: (id) => setGuestModal({ open: true, editId: id }),
      closeGuestModal: () => setGuestModal({ open: false }),
      guestModal,

      exportData: () => {
        try {
          const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], {
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
        // Import is a low-priority convenience now that Supabase is the store —
        // it only updates the local view; it does not write back to the DB.
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<BookingData>;
        setData((prev) => ({ ...prev, ...parsed }));
      }
    }),
    [data, hydrated, guestModal, supabase, saveGuest, patchGuestAndSave]
  );

  return (
    <BookingContext.Provider value={value}>
      {!hydrated ? (
        <div className="flex min-h-[60vh] items-center justify-center text-[13px] font-semibold text-mx-muted">
          Loading booking data…
        </div>
      ) : (
        children
      )}
      <GuestModal />
    </BookingContext.Provider>
  );
}
