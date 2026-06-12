/**
 * One-time backfill: load the exported podcast-dashboard data into the booking
 * tables created in migration 0007.
 *
 *   pnpm tsx scripts/import-booking-data.ts
 *
 * Reads the real export from scripts/import/podcast-dashboard-data.json and
 * UPSERTs each collection on `id`, so it is safe to re-run. Uses the service
 * role client (bypasses RLS) — this is a trusted admin backfill, not app code.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

/* ── env ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/* ── source file ──────────────────────────────────────────────────────────── */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'import/podcast-dashboard-data.json');

interface ExportShape {
  guests?: any[];
  kyle?: any[];
  kyleTravel?: any[];
  outreach?: any[];
  emailTemplates?: any[];
  videoClips?: any[];
  igIdeas?: any[];
  podcastIdeas?: any[];
  prLinks?: any[];
  hotelContacts?: any[];
  travelTemplates?: any[];
  reminders?: any[];
  prOpportunities?: any[];
}

let raw: ExportShape;
try {
  raw = JSON.parse(readFileSync(SRC, 'utf8')) as ExportShape;
} catch (err) {
  console.error(`Could not read export at ${SRC}`);
  console.error('Place the export there first, then re-run.');
  console.error(err);
  process.exit(1);
}

/* ── coercion helpers ─────────────────────────────────────────────────────── */

/** Empty string / undefined → null; otherwise the trimmed string. */
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Empty string / undefined / NaN → null; otherwise an integer. */
function int(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number.parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

/** Date columns: empty string → null; otherwise pass through the date string. */
function date(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true';
}

/* ── per-collection mappers ───────────────────────────────────────────────── */

const KNOWN_PENDING = [
  'Awaiting response',
  'Scheduling conflict',
  'Guest requested later date',
  'Need more info',
  'On hold'
];

const FIELD_KEY_REMAP: Record<string, string> = {
  checkIn: 'hotelCheckIn',
  checkOut: 'hotelCheckOut',
  coffeeTime: 'conradTime'
};

function mapGuest(g: any) {
  // Build tasks { done, fields } from the export's per-task object.
  const done: string[] = [];
  const fields: Record<string, string> = {};
  const tasks = g.tasks && typeof g.tasks === 'object' ? g.tasks : {};
  for (const [key, val] of Object.entries<any>(tasks)) {
    if (val && val.done === true) done.push(key);
    const fieldData = val && val.fieldData;
    if (fieldData && typeof fieldData === 'object') {
      for (const [fk, fv] of Object.entries<any>(fieldData)) {
        const mapped = FIELD_KEY_REMAP[fk] ?? fk;
        if (fv != null && String(fv).trim() !== '') fields[mapped] = String(fv);
      }
    }
  }

  // Pending reason: known value passes through; any other non-empty → "Other".
  let pendingReason: string | null = null;
  let pendingReasonOther: string | null = null;
  const pr = str(g.pendingReason);
  if (pr) {
    if (KNOWN_PENDING.includes(pr)) {
      pendingReason = pr;
    } else {
      pendingReason = 'Other';
      pendingReasonOther = pr;
    }
  }

  return {
    id: String(g.id),
    name: str(g.name) ?? 'Guest',
    email: str(g.email),
    episode: int(g.episode),
    recording_date: date(g.recordingDate),
    recording_time: str(g.recordingTime),
    duration: int(g.duration),
    location: str(g.location),
    notes: str(g.notes),
    confirmed: bool(g.confirmed),
    pending_reason: pendingReason,
    pending_reason_other: pendingReasonOther,
    tasks: { done, fields }
  };
}

function mapAvailability(a: any) {
  const from = str(a.from);
  const until = str(a.to);
  let kind: string;
  if (until && until <= '12:00') kind = 'morning';
  else if (from && from >= '12:00') kind = 'afternoon';
  else kind = 'all_day';
  return {
    id: String(a.id),
    date: date(a.date),
    from_time: from,
    until_time: until,
    kind,
    note: str(a.note)
  };
}

function mapTravel(t: any) {
  return {
    id: String(t.id),
    destination: str(t.destination),
    color: str(t.color),
    start_date: date(t.startDate),
    end_date: date(t.endDate)
  };
}

function mapOutreach(o: any) {
  const r = str(o.response);
  let response: string;
  if (r === 'yes') response = 'responded';
  else if (r === 'passed') response = 'passed';
  else response = 'no_response'; // 'no' and anything else
  return {
    id: String(o.id),
    name: str(o.name),
    note: str(o.notes),
    business: str(o.business),
    contact: str(o.contact),
    reached_out: date(o.dateReachedOut),
    response
  };
}

function mapScript(s: any) {
  return {
    id: String(s.id),
    title: str(s.label),
    category: str(s.category),
    body: str(s.script)
  };
}

function mapClip(c: any) {
  return {
    id: String(c.id),
    title: str(c.title),
    date: date(c.date),
    drive: str(c.drive),
    edited: bool(c.edited),
    posted: bool(c.posted)
  };
}

function mapIdea(kind: 'ig' | 'podcast') {
  return (i: any) => ({
    id: String(i.id),
    kind,
    text: str(i.text),
    color: str(i.color)
  });
}

function mapPrLink(l: any) {
  return { id: String(l.id), label: str(l.label), url: str(l.url) };
}

function mapHotelContact(h: any) {
  return {
    id: String(h.id),
    name: str(h.name),
    role: str(h.role),
    phone: str(h.phone),
    email: str(h.email)
  };
}

function mapTravelTemplate(t: any) {
  return { id: String(t.id), label: str(t.label), body: str(t.text) };
}

function mapReminder(r: any) {
  return {
    id: String(r.id),
    title: str(r.title),
    info: str(r.info),
    event_date: date(r.eventDate),
    reminder_date: date(r.reminderDate)
  };
}

function mapPrOpportunity(p: any) {
  return {
    id: String(p.id),
    title: str(p.title),
    info: str(p.info),
    date: date(p.date),
    link: str(p.link)
  };
}

/* ── upsert runner ────────────────────────────────────────────────────────── */

async function upsert(
  table: string,
  source: any[] | undefined,
  mapper: (row: any) => Record<string, unknown>
): Promise<number> {
  const rows = (source ?? []).map(mapper);
  if (rows.length === 0) {
    console.log(`  ${table.padEnd(20)} 0 rows (nothing in export)`);
    return 0;
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`  ${table.padEnd(20)} FAILED: ${error.message}`);
    throw error;
  }
  console.log(`  ${table.padEnd(20)} ${rows.length} upserted`);
  return rows.length;
}

/* ── run ──────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Importing booking data from ${SRC}\n`);

  await upsert('booking_guests', raw.guests, mapGuest);
  await upsert('kyle_availability', raw.kyle, mapAvailability);
  await upsert('kyle_travel', raw.kyleTravel, mapTravel);
  await upsert('outreach_contacts', raw.outreach, mapOutreach);
  await upsert('email_scripts', raw.emailTemplates, mapScript);
  await upsert('video_clips', raw.videoClips, mapClip);

  const ideaRows = [
    ...(raw.igIdeas ?? []).map(mapIdea('ig')),
    ...(raw.podcastIdeas ?? []).map(mapIdea('podcast'))
  ];
  await upsert('content_ideas', ideaRows, (r) => r);

  await upsert('pr_links', raw.prLinks, mapPrLink);
  await upsert('hotel_contacts', raw.hotelContacts, mapHotelContact);
  await upsert('travel_templates', raw.travelTemplates, mapTravelTemplate);
  await upsert('reminders', raw.reminders, mapReminder);
  await upsert('pr_opportunities', raw.prOpportunities, mapPrOpportunity);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nImport failed.');
  console.error(err);
  process.exit(1);
});
