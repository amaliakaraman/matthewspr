-- ════════════════════════════════════════════════════════════════════════════
--  Podcast Booking tables — additive, separate from the socials data layer.
--
--  Design notes:
--   • Flat access model: NO org_id. Only ~3 teammates ever sign in, and they all
--     share one booking workspace. RLS = authenticated users get full CRUD.
--   • Every table uses a `text` primary key so we can preserve the ids from the
--     exported dashboard and make re-imports an idempotent upsert. The app
--     generates client-side ids for brand-new rows.
--   • Realtime: all tables are added to the supabase_realtime publication so an
--     edit by one signed-in user broadcasts to the other two.
--   • Reuses the public.set_updated_at() trigger function defined in 0001.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.booking_guests (
  id                  text primary key,
  name                text not null,
  email               text,
  episode             int,
  recording_date      date,
  recording_time      text,                     -- 'HH:MM'
  duration            int,
  location            text,                     -- 'nashville' | 'away' | null
  notes               text,
  confirmed           boolean not null default false,
  pending_reason      text,
  pending_reason_other text,
  tasks               jsonb not null default '{"done":[],"fields":{}}'::jsonb,
  updated_at          timestamptz default now()
);

create table if not exists public.kyle_availability (
  id          text primary key,
  date        date,
  from_time   text,
  until_time  text,
  kind        text,
  note        text,
  updated_at  timestamptz default now()
);

create table if not exists public.kyle_travel (
  id           text primary key,
  destination  text,
  color        text,
  start_date   date,
  end_date     date,
  updated_at   timestamptz default now()
);

create table if not exists public.outreach_contacts (
  id           text primary key,
  name         text,
  note         text,
  business     text,
  contact      text,
  reached_out  date,
  response     text,
  updated_at   timestamptz default now()
);

create table if not exists public.email_scripts (
  id          text primary key,
  title       text,
  category    text,
  body        text,
  updated_at  timestamptz default now()
);

create table if not exists public.video_clips (
  id          text primary key,
  title       text,
  date        date,
  drive       text,
  edited      boolean default false,
  posted      boolean default false,
  updated_at  timestamptz default now()
);

create table if not exists public.content_ideas (
  id          text primary key,
  kind        text,                             -- 'ig' | 'podcast'
  text        text,
  color       text,
  updated_at  timestamptz default now()
);

create table if not exists public.pr_links (
  id          text primary key,
  label       text,
  url         text,
  updated_at  timestamptz default now()
);

create table if not exists public.hotel_contacts (
  id          text primary key,
  name        text,
  role        text,
  phone       text,
  email       text,
  updated_at  timestamptz default now()
);

create table if not exists public.travel_templates (
  id          text primary key,
  label       text,
  body        text,
  updated_at  timestamptz default now()
);

create table if not exists public.reminders (
  id             text primary key,
  title          text,
  info           text,
  event_date     date,
  reminder_date  date,
  updated_at     timestamptz default now()
);

create table if not exists public.pr_opportunities (
  id          text primary key,
  title       text,
  info        text,
  date        date,
  link        text,
  updated_at  timestamptz default now()
);

-- ── Row Level Security: authenticated users get full CRUD on everything ───────

alter table public.booking_guests    enable row level security;
alter table public.kyle_availability enable row level security;
alter table public.kyle_travel       enable row level security;
alter table public.outreach_contacts enable row level security;
alter table public.email_scripts     enable row level security;
alter table public.video_clips       enable row level security;
alter table public.content_ideas     enable row level security;
alter table public.pr_links          enable row level security;
alter table public.hotel_contacts    enable row level security;
alter table public.travel_templates  enable row level security;
alter table public.reminders         enable row level security;
alter table public.pr_opportunities  enable row level security;

-- Drop-then-create so this migration is safe to re-run after a partial apply.
drop policy if exists "booking: authenticated full access" on public.booking_guests;
create policy "booking: authenticated full access" on public.booking_guests
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.kyle_availability;
create policy "booking: authenticated full access" on public.kyle_availability
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.kyle_travel;
create policy "booking: authenticated full access" on public.kyle_travel
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.outreach_contacts;
create policy "booking: authenticated full access" on public.outreach_contacts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.email_scripts;
create policy "booking: authenticated full access" on public.email_scripts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.video_clips;
create policy "booking: authenticated full access" on public.video_clips
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.content_ideas;
create policy "booking: authenticated full access" on public.content_ideas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.pr_links;
create policy "booking: authenticated full access" on public.pr_links
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.hotel_contacts;
create policy "booking: authenticated full access" on public.hotel_contacts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.travel_templates;
create policy "booking: authenticated full access" on public.travel_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.reminders;
create policy "booking: authenticated full access" on public.reminders
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "booking: authenticated full access" on public.pr_opportunities;
create policy "booking: authenticated full access" on public.pr_opportunities
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── updated_at triggers (reuse set_updated_at() from 0001) ────────────────────

drop trigger if exists booking_guests_updated_at    on public.booking_guests;
create trigger booking_guests_updated_at    before update on public.booking_guests    for each row execute function public.set_updated_at();
drop trigger if exists kyle_availability_updated_at on public.kyle_availability;
create trigger kyle_availability_updated_at before update on public.kyle_availability for each row execute function public.set_updated_at();
drop trigger if exists kyle_travel_updated_at       on public.kyle_travel;
create trigger kyle_travel_updated_at       before update on public.kyle_travel       for each row execute function public.set_updated_at();
drop trigger if exists outreach_contacts_updated_at on public.outreach_contacts;
create trigger outreach_contacts_updated_at before update on public.outreach_contacts for each row execute function public.set_updated_at();
drop trigger if exists email_scripts_updated_at     on public.email_scripts;
create trigger email_scripts_updated_at     before update on public.email_scripts     for each row execute function public.set_updated_at();
drop trigger if exists video_clips_updated_at       on public.video_clips;
create trigger video_clips_updated_at       before update on public.video_clips       for each row execute function public.set_updated_at();
drop trigger if exists content_ideas_updated_at     on public.content_ideas;
create trigger content_ideas_updated_at     before update on public.content_ideas     for each row execute function public.set_updated_at();
drop trigger if exists pr_links_updated_at          on public.pr_links;
create trigger pr_links_updated_at          before update on public.pr_links          for each row execute function public.set_updated_at();
drop trigger if exists hotel_contacts_updated_at    on public.hotel_contacts;
create trigger hotel_contacts_updated_at    before update on public.hotel_contacts    for each row execute function public.set_updated_at();
drop trigger if exists travel_templates_updated_at  on public.travel_templates;
create trigger travel_templates_updated_at  before update on public.travel_templates  for each row execute function public.set_updated_at();
drop trigger if exists reminders_updated_at         on public.reminders;
create trigger reminders_updated_at         before update on public.reminders         for each row execute function public.set_updated_at();
drop trigger if exists pr_opportunities_updated_at  on public.pr_opportunities;
create trigger pr_opportunities_updated_at  before update on public.pr_opportunities  for each row execute function public.set_updated_at();

-- ── Realtime: broadcast every booking edit to all signed-in users ────────────

-- Add each table only if it isn't already a member, so re-runs don't error.
do $$
declare
  t text;
  tables text[] := array[
    'booking_guests', 'kyle_availability', 'kyle_travel', 'outreach_contacts',
    'email_scripts', 'video_clips', 'content_ideas', 'pr_links',
    'hotel_contacts', 'travel_templates', 'reminders', 'pr_opportunities'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
