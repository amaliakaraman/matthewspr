/**
 * Demo fixtures + pure logic for the Podcast Booking side of the app.
 *
 * IMPORTANT: mock/seed data only — no DB tables, migrations, or backend. The
 * booking UI runs entirely off this file via a localStorage-backed client
 * context (`components/booking/BookingProvider`). All "logic" here is pure and
 * framework-free: derived status, conflict detection, and reminder triage are
 * ported faithfully from the original Netlify Booking Dashboard.
 */

/* ── Tasks ────────────────────────────────────────────────────────────────── */

export type TaskId =
  | 'calInvite'
  | 'hotel'
  | 'conradCoffee'
  | 'flight'
  | 'uberVoucher'
  | 'googleForm'
  | 'prepSheet'
  | 'printPrep'
  | 'recordedPod'
  | 'draftReview'
  | 'episodeLive'
  | 'giftBox';

export type TaskPhase = 'pre' | 'post';
/** v2 room: which guests a task applies to. v1 always shows all 12. */
export type AppliesTo = 'all' | 'nashville' | 'away';

export interface TaskField {
  key: string;
  label: string;
  type: 'date' | 'time';
}

export interface TaskDef {
  id: TaskId;
  label: string;
  sub?: string;
  phase: TaskPhase;
  appliesTo: AppliesTo;
  fields?: TaskField[];
  /** v2 room: optional deep-link to a Library script. */
  scriptId?: string;
}

export const TASKS: TaskDef[] = [
  { id: 'calInvite', label: 'Send Calendar Invite', sub: 'Send recording date invite to guest', phase: 'pre', appliesTo: 'all' },
  {
    id: 'hotel',
    label: 'Book Hotel',
    phase: 'pre',
    appliesTo: 'away',
    fields: [
      { key: 'hotelCheckIn', label: 'Check-In Date', type: 'date' },
      { key: 'hotelCheckOut', label: 'Check-Out Date', type: 'date' }
    ],
    scriptId: 's-travel'
  },
  {
    id: 'conradCoffee',
    label: 'Book Conrad Coffee Chat',
    phase: 'pre',
    appliesTo: 'away',
    fields: [{ key: 'conradTime', label: 'Time', type: 'time' }]
  },
  { id: 'flight', label: 'Book Flight', phase: 'pre', appliesTo: 'away' },
  { id: 'uberVoucher', label: 'Send Uber Voucher', phase: 'pre', appliesTo: 'away' },
  { id: 'googleForm', label: 'Email Google Form to Guest', sub: 'Send intake form link', phase: 'pre', appliesTo: 'all', scriptId: 's-intake' },
  { id: 'prepSheet', label: 'Email Prep Sheet to Guest', sub: 'Send episode prep / talking points', phase: 'pre', appliesTo: 'all', scriptId: 's-prep' },
  { id: 'printPrep', label: 'Print Prep Doc Copies', sub: 'Nashville only — print before recording day', phase: 'pre', appliesTo: 'nashville' },
  { id: 'recordedPod', label: 'Recorded Podcast', phase: 'pre', appliesTo: 'all' },
  { id: 'draftReview', label: 'Email Episode Draft for Review', sub: 'Send draft link for guest approval', phase: 'post', appliesTo: 'all', scriptId: 's-draft' },
  { id: 'episodeLive', label: 'Email Episode is Live', sub: 'Notify guest – streaming on all platforms', phase: 'post', appliesTo: 'all', scriptId: 's-live' },
  { id: 'giftBox', label: 'Mail Gift Box', sub: 'Ship thank-you gift to guest', phase: 'post', appliesTo: 'all' }
];

export const PRE_TASK_IDS: TaskId[] = TASKS.filter((t) => t.phase === 'pre').map((t) => t.id);
export const POST_TASK_IDS: TaskId[] = TASKS.filter((t) => t.phase === 'post').map((t) => t.id);
export const TASK_COUNT = TASKS.length; // 12

/* ── Guests ───────────────────────────────────────────────────────────────── */

export type LocationKind = 'nashville' | 'away';
export type DerivedStage = 'pending' | 'in_progress' | 'recorded' | 'completed';

export interface Guest {
  id: string;
  name: string;
  email?: string;
  episode?: number;
  recordingDate: string; // ISO yyyy-mm-dd
  recordingTime: string; // 'HH:MM' 24h
  duration: number; // minutes
  location: LocationKind;
  notes?: string;
  confirmed: boolean;
  pendingReason?: string;
  pendingReasonOther?: string;
  done: TaskId[];
  fields: Record<string, string>;
}

export const PENDING_REASONS = [
  'Awaiting response',
  'Scheduling conflict',
  'Guest requested later date',
  'Need more info',
  'On hold',
  'Other'
] as const;

export const STAGES: { id: DerivedStage; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'recorded', label: 'Recorded' },
  { id: 'completed', label: 'Completed' }
];

/* ── Kyle availability + travel ───────────────────────────────────────────── */

export type AvailabilityKind = 'morning' | 'afternoon' | 'all_day' | 'not_available';

export interface AvailabilityBlock {
  id: string;
  date: string; // ISO yyyy-mm-dd
  from: string; // 'HH:MM'
  until: string; // 'HH:MM'
  kind: AvailabilityKind;
  note?: string;
}

export interface TravelRange {
  id: string;
  destination: string;
  color: string;
  start: string; // ISO date
  end: string; // ISO date
}

/* ── Outreach / Scripts / PR / Content ────────────────────────────────────── */

export type OutreachResponse = 'no_response' | 'responded' | 'passed';

export interface OutreachRow {
  id: string;
  name: string;
  note?: string;
  business: string;
  contact: string;
  reachedOut: string; // ISO date
  response: OutreachResponse;
}

export type ScriptCategory =
  | 'Outreach'
  | 'Booking Confirmation'
  | 'Travel Info'
  | 'Prep Sheet'
  | 'Follow-up'
  | 'Episode Live'
  | 'Other';

export const SCRIPT_CATEGORIES: ScriptCategory[] = [
  'Outreach',
  'Booking Confirmation',
  'Travel Info',
  'Prep Sheet',
  'Follow-up',
  'Episode Live',
  'Other'
];

export interface EmailScript {
  id: string;
  title: string;
  category: ScriptCategory;
  subject: string;
  body: string;
}

export interface ResourceLink {
  label: string;
  description: string;
  href: string;
}

export interface ContactCard {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface VideoClip {
  id: string;
  title: string;
  date: string;
  driveNumber: string;
  edited: boolean;
  posted: boolean;
}

export interface Idea {
  id: string;
  text: string;
}

/** A stored reminder row (distinct from the derived task `Reminder` below). */
export interface ReminderEntry {
  id: string;
  title: string;
  info?: string;
  eventDate?: string; // ISO yyyy-mm-dd
  reminderDate?: string; // ISO yyyy-mm-dd
}

/* ── The full demo dataset shape (what the provider persists) ──────────────── */

export interface BookingData {
  guests: Guest[];
  availability: AvailabilityBlock[];
  travel: TravelRange[];
  outreach: OutreachRow[];
  scripts: EmailScript[];
  clips: VideoClip[];
  igIdeas: Idea[];
  podcastIdeas: Idea[];
  reminders: ReminderEntry[];
}

/* ════════════════════════════════════════════════════════════════════════════
   PURE LOGIC — ported from the original Booking Dashboard
   ════════════════════════════════════════════════════════════════════════════ */

export function guestName(g: Guest): string {
  return g.name.trim();
}

/** Derived status — never set manually; stages are not draggable. */
export function deriveStatus(g: Guest): DerivedStage {
  if (!g.confirmed) return 'pending';
  const allDone = TASKS.every((t) => g.done.includes(t.id));
  if (allDone) return 'completed';
  const preDone = PRE_TASK_IDS.every((id) => g.done.includes(id));
  if (preDone) return 'recorded';
  return 'in_progress';
}

export function doneCount(g: Guest): number {
  return TASKS.filter((t) => g.done.includes(t.id)).length;
}

/* ── Time / date helpers ──────────────────────────────────────────────────── */

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatTime(t: string): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = Number(hStr);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** Local-midnight Date from an ISO yyyy-mm-dd (avoids TZ drift). */
export function dateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function daysUntil(iso: string, from: Date = startOfToday()): number {
  const ms = dateOnly(iso).getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
}

/* ── §1c Automatic conflict detection ─────────────────────────────────────── */

export interface ConflictResult {
  messages: string[];
  availabilityConflict: boolean;
  hotelConflict: boolean;
  has: boolean;
}

export function getConflicts(g: Guest, availability: AvailabilityBlock[]): ConflictResult {
  const messages: string[] = [];
  let availabilityConflict = false;
  let hotelConflict = false;

  // 1) Recording must fit entirely inside one of Kyle's available blocks that day.
  const blocksToday = availability.filter((b) => b.date === g.recordingDate);
  const availableWindows = blocksToday.filter((b) => b.kind !== 'not_available');
  if (availableWindows.length > 0 && g.recordingTime) {
    const start = timeToMinutes(g.recordingTime);
    const end = start + (g.duration || 0);
    const fits = availableWindows.some(
      (b) => start >= timeToMinutes(b.from) && end <= timeToMinutes(b.until)
    );
    if (!fits) {
      availabilityConflict = true;
      messages.push("Recording time falls outside Kyle's available hours on this day.");
    }
  }

  // 2) Hotel checks out before the recording date.
  const checkOut = g.fields?.hotelCheckOut;
  if (checkOut && g.recordingDate && dateOnly(checkOut) < dateOnly(g.recordingDate)) {
    hotelConflict = true;
    messages.push(
      `Hotel checks out on ${formatDateShort(checkOut)} — before the recording date.`
    );
  }

  return {
    messages,
    availabilityConflict,
    hotelConflict,
    has: messages.length > 0
  };
}

export function formatDateShort(iso: string): string {
  return dateOnly(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── §1d Action reminders (deadline triage) ───────────────────────────────── */

export type Urgency = 'overdue' | 'soon' | 'later';

export interface Reminder {
  guestId: string;
  guestName: string;
  taskId: TaskId;
  taskLabel: string;
  daysUntil: number;
  urgency: Urgency;
  badge: string;
}

interface ReminderRule {
  taskId: TaskId;
  withinDays: number;
  nashvilleOnly?: boolean;
}

const REMINDER_RULES: ReminderRule[] = [
  { taskId: 'googleForm', withinDays: 14 },
  { taskId: 'prepSheet', withinDays: 7 },
  { taskId: 'printPrep', withinDays: 1, nashvilleOnly: true }
];

function urgencyFor(d: number): Urgency {
  if (d < 0) return 'overdue';
  if (d <= 3) return 'soon';
  return 'later';
}

function badgeFor(d: number): string {
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'today';
  return `${d}d left`;
}

export function getReminders(guests: Guest[], from: Date = startOfToday()): Reminder[] {
  const out: Reminder[] = [];
  for (const g of guests) {
    if (!g.confirmed) continue;
    const d = daysUntil(g.recordingDate, from);
    if (d < -3) continue; // only recordings from 3 days ago onward
    for (const rule of REMINDER_RULES) {
      if (rule.nashvilleOnly && g.location !== 'nashville') continue;
      if (g.done.includes(rule.taskId)) continue;
      if (d > rule.withinDays) continue;
      const task = TASKS.find((t) => t.id === rule.taskId)!;
      out.push({
        guestId: g.id,
        guestName: guestName(g),
        taskId: rule.taskId,
        taskLabel: task.label,
        daysUntil: d,
        urgency: urgencyFor(d),
        badge: badgeFor(d)
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/* ════════════════════════════════════════════════════════════════════════════
   SEED DATA
   ════════════════════════════════════════════════════════════════════════════ */

const ALL_TASK_IDS = TASKS.map((t) => t.id);

export const DEMO_GUESTS: Guest[] = [
  // Completed
  {
    id: 'g-burcham',
    name: 'Michael Burcham',
    email: 'michael.burcham@example.com',
    episode: 98,
    recordingDate: '2026-06-05',
    recordingTime: '10:00',
    duration: 90,
    location: 'nashville',
    notes: 'Healthcare entrepreneur, founder of Narus Health. Long-time friend of the show.',
    confirmed: true,
    done: [...ALL_TASK_IDS],
    fields: { conradTime: '09:00' }
  },
  // Recorded (all PRE done, POST pending)
  {
    id: 'g-ricco',
    name: 'Marc Ricco',
    email: 'marc.ricco@example.com',
    episode: 101,
    recordingDate: '2026-06-20',
    recordingTime: '14:00',
    duration: 90,
    location: 'away',
    notes: 'Operator & investor. Flew in from Austin.',
    confirmed: true,
    done: [...PRE_TASK_IDS],
    fields: { hotelCheckIn: '2026-06-19', hotelCheckOut: '2026-06-21', conradTime: '08:30' }
  },
  // In progress — today's recording, Nashville, availability conflict + printPrep due today
  {
    id: 'g-beeler',
    name: 'Brad Beeler',
    email: 'brad.beeler@example.com',
    episode: 103,
    recordingDate: '2026-06-12',
    recordingTime: '11:00',
    duration: 90,
    location: 'nashville',
    notes: 'Recording slot runs past Kyle\u2019s morning block — needs a time fix.',
    confirmed: true,
    done: ['calInvite', 'googleForm', 'prepSheet'],
    fields: {}
  },
  // In progress — away, within 7 days, googleForm/prepSheet undone (reminders fire)
  {
    id: 'g-smith',
    name: 'Stephan Smith',
    email: 'stephan@example.com',
    episode: 104,
    recordingDate: '2026-06-15',
    recordingTime: '10:00',
    duration: 90,
    location: 'away',
    notes: 'Founder & operator; great storyteller.',
    confirmed: true,
    done: ['calInvite', 'flight', 'uberVoucher'],
    fields: { hotelCheckIn: '2026-06-14', hotelCheckOut: '2026-06-16' }
  },
  // In progress — away, hotel conflict (checkout before recording)
  {
    id: 'g-chen',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    episode: 105,
    recordingDate: '2026-06-18',
    recordingTime: '13:00',
    duration: 90,
    location: 'away',
    notes: 'Product leader. Double-check the hotel dates.',
    confirmed: true,
    done: ['calInvite', 'flight', 'hotel', 'googleForm'],
    fields: { hotelCheckIn: '2026-06-16', hotelCheckOut: '2026-06-17' }
  },
  // In progress — nashville, minimal done
  {
    id: 'g-rivera',
    name: 'Tom Rivera',
    email: 'tom.rivera@example.com',
    episode: 106,
    recordingDate: '2026-06-29',
    recordingTime: '15:00',
    duration: 90,
    location: 'nashville',
    notes: 'Local founder. Intro via mutual contact.',
    confirmed: true,
    done: ['calInvite'],
    fields: {}
  },
  // Pending — with reason
  {
    id: 'g-liu',
    name: 'Deb Liu',
    email: 'deb.liu@example.com',
    episode: 108,
    recordingDate: '2026-06-26',
    recordingTime: '10:30',
    duration: 90,
    location: 'away',
    notes: 'CEO of Ancestry. Awaiting confirmation on remote date.',
    confirmed: false,
    pendingReason: 'Awaiting response',
    done: [],
    fields: {}
  },
  // Pending — no reason yet
  {
    id: 'g-friedman',
    name: 'Nick Friedman',
    email: 'nick.friedman@example.com',
    episode: 109,
    recordingDate: '2026-07-01',
    recordingTime: '09:30',
    duration: 90,
    location: 'nashville',
    notes: 'Co-founder, College Hunks Hauling Junk.',
    confirmed: false,
    pendingReason: 'Need more info',
    done: [],
    fields: {}
  }
];

export const DEMO_AVAILABILITY: AvailabilityBlock[] = [
  { id: 'a1', date: '2026-06-12', from: '08:00', until: '10:30', kind: 'morning', note: 'Recording window' },
  { id: 'a2', date: '2026-06-15', from: '08:00', until: '12:00', kind: 'morning' },
  { id: 'a3', date: '2026-06-18', from: '12:00', until: '17:00', kind: 'afternoon' },
  { id: 'a4', date: '2026-06-20', from: '12:00', until: '17:00', kind: 'afternoon' },
  { id: 'a5', date: '2026-06-22', from: '00:00', until: '23:59', kind: 'not_available', note: 'Out of office' },
  { id: 'a6', date: '2026-06-26', from: '08:00', until: '12:00', kind: 'morning' },
  { id: 'a7', date: '2026-06-29', from: '13:00', until: '17:00', kind: 'afternoon' },
  { id: 'a8', date: '2026-06-08', from: '00:00', until: '23:59', kind: 'all_day', note: 'Open all day' }
];

export const DEMO_TRAVEL: TravelRange[] = [
  { id: 't1', destination: 'Nashville — guest visit', color: '#4380F3', start: '2026-06-10', end: '2026-06-13' },
  { id: 't2', destination: 'NYC — speaking', color: '#6563EE', start: '2026-06-22', end: '2026-06-24' },
  { id: 't3', destination: 'LA — meetings', color: '#219387', start: '2026-07-01', end: '2026-07-03' }
];

export const DEMO_OUTREACH: OutreachRow[] = [
  { id: 'o1', name: 'Sarah Friar', note: 'CFO intro via warm contact', business: 'OpenAI', contact: 'sarah.friar@example.com', reachedOut: '2026-05-28', response: 'responded' },
  { id: 'o2', name: 'David Cancel', business: 'Drift', contact: 'dcancel@example.com', reachedOut: '2026-05-30', response: 'no_response' },
  { id: 'o3', name: 'Whitney Wolfe Herd', note: 'Routed through press team', business: 'Bumble', contact: 'press@example.com', reachedOut: '2026-06-01', response: 'passed' },
  { id: 'o4', name: 'Ryan Holiday', note: 'Open to Q3', business: 'Daily Stoic', contact: 'ryan@example.com', reachedOut: '2026-06-03', response: 'responded' },
  { id: 'o5', name: 'Codie Sanchez', business: 'Contrarian Thinking', contact: 'team@example.com', reachedOut: '2026-06-05', response: 'no_response' },
  { id: 'o6', name: 'Alex Hormozi', note: 'Via booking agent', business: 'Acquisition.com', contact: 'booking@example.com', reachedOut: '2026-06-08', response: 'no_response' }
];

export const DEMO_SCRIPTS: EmailScript[] = [
  { id: 's-cold', title: 'Cold Guest Invite', category: 'Outreach', subject: 'Invitation: The Matthews Mentality Podcast', body: `Hi {{first_name}},\n\nI produce The Matthews Mentality Podcast with Kyle Matthews — conversations with builders and operators on the mindset behind the work. Your story at {{company}} would resonate deeply with our audience.\n\nWould you be open to a 60-minute recorded conversation? We handle all logistics and can record in Nashville or remotely.\n\nWarmly,\nThe TMMP Team` },
  { id: 's-confirm', title: 'Booking Confirmation', category: 'Booking Confirmation', subject: "You're booked — next steps for your TMMP episode", body: `Hi {{first_name}},\n\nThrilled to have you on. Here's what's confirmed:\n\n• Recording: {{date}} at {{time}} ({{location}})\n• Duration: ~90 minutes\n\nA calendar invite and prep sheet are on the way. If traveling to Nashville, we'll cover hotel + transportation.\n\nTalk soon,\nThe TMMP Team` },
  { id: 's-travel', title: 'Hotel + Travel Logistics', category: 'Travel Info', subject: 'Travel details for your Nashville recording', body: `Hi {{first_name}},\n\nHere are your travel details:\n\n• Hotel: Conrad Nashville (check-in {{checkin}}, check-out {{checkout}})\n• Ground transport: Uber voucher sent separately\n• Coffee chat with Kyle: {{coffee_time}}\n\nLet us know if anything needs adjusting.\n\nThe TMMP Team` },
  { id: 's-intake', title: 'Guest Intake Form', category: 'Prep Sheet', subject: 'Quick intake form before we record', body: `Hi {{first_name}},\n\nWhen you have a moment, please fill out this short intake form — it helps Kyle tailor the conversation: {{form_link}}\n\nNo need to over-prepare; the best episodes are conversational.\n\nThe TMMP Team` },
  { id: 's-prep', title: 'Prep Sheet Send', category: 'Prep Sheet', subject: 'Your prep sheet + a few talking points', body: `Hi {{first_name}},\n\nAttached is your prep sheet with topics and talking points. Looking forward to {{date}}!\n\nThe TMMP Team` },
  { id: 's-draft', title: 'Episode Draft for Review', category: 'Follow-up', subject: 'Your episode draft — take a listen', body: `Hi {{first_name}},\n\nHere's the draft of your episode for review: {{draft_link}}\n\nLet us know if anything should be trimmed before it goes live.\n\nThe TMMP Team` },
  { id: 's-live', title: 'Episode Is Live', category: 'Episode Live', subject: 'Your episode is live!', body: `Hi {{first_name}},\n\nYour episode is officially live and streaming on all platforms. Thank you for such a generous conversation.\n\nShare links and assets are attached — tag @matthewsmentality and we'll amplify. A small gift box is on its way.\n\nWith gratitude,\nThe TMMP Team` }
];

export const KEY_LINKS: ResourceLink[] = [
  { label: 'Guest Intake Google Form', description: 'Sent to every confirmed guest before recording.', href: '#' },
  { label: 'Prep Doc Template', description: 'Kyle\u2019s prep sheet — duplicate per guest.', href: '#' },
  { label: 'Episode Asset Folder', description: 'Audiograms, thumbnails, and share graphics.', href: '#' },
  { label: 'Brand Kit', description: 'Logos, fonts (Satoshi), and color tokens.', href: '#' }
];

export const CONRAD_CONTACTS: ContactCard[] = [
  { name: 'Conrad Nashville — Front Desk', role: 'Reservations', phone: '(615) 555-0142', email: 'reservations@example.com' },
  { name: 'Marissa Vance', role: 'Group Sales Manager', phone: '(615) 555-0188', email: 'marissa.v@example.com' },
  { name: 'Conrad Coffee Lounge', role: 'Coffee chat venue', phone: '(615) 555-0170', email: 'lounge@example.com' }
];

export const INVITE_TEMPLATES: ResourceLink[] = [
  { label: 'Calendar Invite Template', description: 'Recording slot + dial-in details.', href: '#' },
  { label: 'Travel Info Template', description: 'Hotel, flight, and Uber voucher summary.', href: '#' },
  { label: 'Gift Box Order Sheet', description: 'Post-episode thank-you fulfillment.', href: '#' }
];

export const DEMO_CLIPS: VideoClip[] = [
  { id: 'c1', title: 'On building before you\u2019re ready', date: '2026-06-06', driveNumber: 'KM-0312', edited: true, posted: true },
  { id: 'c2', title: 'The 5am myth', date: '2026-06-08', driveNumber: 'KM-0313', edited: true, posted: false },
  { id: 'c3', title: 'Hiring for slope, not intercept', date: '2026-06-10', driveNumber: 'KM-0314', edited: false, posted: false }
];

export const DEMO_IG_IDEAS: Idea[] = [
  { id: 'ig1', text: 'Carousel: 3 lessons from the Burcham episode' },
  { id: 'ig2', text: 'Reel: behind-the-scenes of a Nashville recording day' },
  { id: 'ig3', text: 'Quote graphic: "Momentum compounds"' }
];

export const DEMO_PODCAST_IDEAS: Idea[] = [
  { id: 'p1', text: 'Episode on founder mental health' },
  { id: 'p2', text: 'Series: operators who scaled past 100 employees' },
  { id: 'p3', text: 'Live recording at a Nashville event' }
];

export function seedData(): BookingData {
  return {
    guests: structuredCloneSafe(DEMO_GUESTS),
    availability: structuredCloneSafe(DEMO_AVAILABILITY),
    travel: structuredCloneSafe(DEMO_TRAVEL),
    outreach: structuredCloneSafe(DEMO_OUTREACH),
    scripts: structuredCloneSafe(DEMO_SCRIPTS),
    clips: structuredCloneSafe(DEMO_CLIPS),
    igIdeas: structuredCloneSafe(DEMO_IG_IDEAS),
    podcastIdeas: structuredCloneSafe(DEMO_PODCAST_IDEAS),
    reminders: []
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
