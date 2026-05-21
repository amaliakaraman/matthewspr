-- ════════════════════════════════════════════════════════════════════════════
--  KM Socials Command Center — initial schema
--  Multi-tenant via `org_id`. Time-series first: every metric goes into
--  `snapshots` and `post_snapshots` so we can chart history forever.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ── ENUMS ──────────────────────────────────────────────────────────────────
create type platform_kind as enum (
  'spotify','captivate','youtube','instagram','tiktok','linkedin','x'
);

create type account_kind as enum (
  'personal',   -- e.g. Kyle Matthews
  'show'        -- e.g. The Matthews Mentality Podcast
);

create type member_role as enum ('owner','admin','editor','viewer');

create type connection_status as enum (
  'connected','disconnected','expired','manual_only','error'
);

create type snapshot_source as enum (
  'manual','api_pull','cron','import'
);

-- ── CORE: ORGS + USERS ────────────────────────────────────────────────────
create table public.orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  brand_color text default '#38BDF8',
  logo_url text
);

create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'editor',
  invited_email text,
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members(user_id);

-- ── ACCOUNTS (KM, TMMP, future shows) ─────────────────────────────────────
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  label text not null,         -- "Kyle Matthews", "The Matthews Mentality Podcast"
  tag text not null,           -- "KM", "TMMP"
  kind account_kind not null,
  brand_color text default '#38BDF8',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index accounts_org_tag_idx on public.accounts(org_id, tag);

-- ── PLATFORM CONNECTIONS (encrypted tokens) ───────────────────────────────
-- One row per account × platform. `access_token` and `refresh_token` are
-- AES-GCM encrypted in the app layer before insert (TOKEN_ENCRYPTION_KEY).
create table public.platform_connections (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  platform platform_kind not null,
  handle text,                 -- @kylematthews_
  profile_url text,
  external_id text,            -- the platform's own ID for this account
  status connection_status not null default 'manual_only',
  access_token_enc text,       -- AES-GCM ciphertext (base64)
  refresh_token_enc text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz,
  last_pull_at timestamptz,
  last_pull_error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pc_account_platform_idx
  on public.platform_connections(account_id, platform);

-- ── SNAPSHOTS (time-series of account×platform×period) ────────────────────
create table public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  connection_id uuid references public.platform_connections(id) on delete set null,
  platform platform_kind not null,
  captured_at timestamptz not null default now(),
  period_label text,           -- "April 22 – May 6"
  period_start date,
  period_end date,
  source snapshot_source not null default 'manual',

  -- universal metrics (null where N/A per platform)
  followers bigint,
  growth bigint,               -- delta vs prior snapshot
  views bigint,
  impressions bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_seconds bigint,
  avg_watch_seconds numeric,
  engagement_rate numeric,
  profile_visits bigint,
  downloads bigint,            -- podcast
  plays bigint,                -- podcast
  unique_listeners bigint,
  episodes int,

  raw jsonb not null default '{}'::jsonb,  -- the full API payload, never lossy

  created_at timestamptz not null default now()
);
create index snapshots_account_platform_time_idx
  on public.snapshots(account_id, platform, captured_at desc);
create index snapshots_org_time_idx
  on public.snapshots(org_id, captured_at desc);

-- ── POSTS (top posts per snapshot) ─────────────────────────────────────────
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  platform platform_kind not null,
  external_id text,
  posted_at timestamptz,
  title text,
  caption text,
  permalink text,
  media_url text,              -- direct CDN URL from platform (may expire)
  media_blob_url text,         -- persistent copy in Vercel Blob
  thumb_blob_url text,
  is_top boolean default true,
  rank int,                    -- 1 = top performing in this snapshot

  views bigint,
  impressions bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  follows bigint,              -- follows attributed to this post
  visits bigint,               -- profile visits attributed
  watch_seconds bigint,
  avg_watch_seconds numeric,
  downloads bigint,
  plays bigint,

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index posts_snapshot_idx on public.posts(snapshot_id);
create index posts_account_platform_idx on public.posts(account_id, platform);

-- ── AI INSIGHTS ────────────────────────────────────────────────────────────
create table public.insights (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  snapshot_id uuid references public.snapshots(id) on delete cascade,
  kind text not null,          -- "weekly","platform_compare","content_strategy","recap_copy"
  prompt text,
  output_md text not null,     -- markdown
  output_json jsonb,           -- structured (callouts, suggestions, charts to render)
  model text default 'claude-opus-4-6',
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index insights_account_kind_time_idx
  on public.insights(account_id, kind, created_at desc);

-- ── RECAPS (saved branded reports) ─────────────────────────────────────────
create table public.recaps (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  period_label text,
  period_start date,
  period_end date,
  template text not null default 'full',  -- "km-full","tmmp-full","combined","custom"
  account_ids uuid[] not null default '{}',
  layout jsonb not null default '{}'::jsonb,  -- ordered pages spec
  pdf_blob_url text,
  png_blob_urls text[] default '{}',
  cover_blob_url text,
  notes_md text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── CRON LOG ──────────────────────────────────────────────────────────────
create table public.cron_runs (
  id uuid primary key default uuid_generate_v4(),
  job text not null,
  org_id uuid references public.orgs(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  message text,
  results jsonb default '{}'::jsonb
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.orgs                 enable row level security;
alter table public.org_members          enable row level security;
alter table public.accounts             enable row level security;
alter table public.platform_connections enable row level security;
alter table public.snapshots            enable row level security;
alter table public.posts                enable row level security;
alter table public.insights             enable row level security;
alter table public.recaps               enable row level security;

-- Helper: is the calling user a member of `org_id`?
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer
as $$
  select exists(
    select 1 from public.org_members
    where org_id = org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql stable security definer
as $$
  select exists(
    select 1 from public.org_members
    where org_id = org and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- Generic policies
create policy "orgs: members can read"     on public.orgs
  for select using (public.is_org_member(id));
create policy "orgs: admins can update"    on public.orgs
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy "members: self read"         on public.org_members
  for select using (user_id = auth.uid() or public.is_org_member(org_id));
create policy "members: admin manage"      on public.org_members
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "accounts: read"             on public.accounts
  for select using (public.is_org_member(org_id));
create policy "accounts: write"            on public.accounts
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "pc: read via account"       on public.platform_connections
  for select using (
    exists(select 1 from public.accounts a
           where a.id = account_id and public.is_org_member(a.org_id))
  );
create policy "pc: admin write"            on public.platform_connections
  for all using (
    exists(select 1 from public.accounts a
           where a.id = account_id and public.is_org_admin(a.org_id))
  ) with check (
    exists(select 1 from public.accounts a
           where a.id = account_id and public.is_org_admin(a.org_id))
  );

create policy "snapshots: read"            on public.snapshots
  for select using (public.is_org_member(org_id));
create policy "snapshots: write"           on public.snapshots
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "posts: read"                on public.posts
  for select using (
    exists(select 1 from public.snapshots s
           where s.id = snapshot_id and public.is_org_member(s.org_id))
  );
create policy "posts: write"               on public.posts
  for all using (
    exists(select 1 from public.snapshots s
           where s.id = snapshot_id and public.is_org_member(s.org_id))
  ) with check (
    exists(select 1 from public.snapshots s
           where s.id = snapshot_id and public.is_org_member(s.org_id))
  );

create policy "insights: read"             on public.insights
  for select using (public.is_org_member(org_id));
create policy "insights: write"            on public.insights
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "recaps: read"               on public.recaps
  for select using (public.is_org_member(org_id));
create policy "recaps: write"              on public.recaps
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger pc_updated_at before update on public.platform_connections
  for each row execute function public.set_updated_at();
create trigger recaps_updated_at before update on public.recaps
  for each row execute function public.set_updated_at();
-- ════════════════════════════════════════════════════════════════════════════
--  Seed — run AFTER you've signed up for the app at /login.
--  Replace `YOUR_USER_ID` with the uuid from auth.users (Supabase → Authentication).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) The org
insert into public.orgs (id, name, slug, brand_color)
values ('00000000-0000-0000-0000-000000000001', 'Matthews Mentality', 'mm', '#38BDF8')
on conflict (id) do nothing;

-- 2) You as owner — uncomment and replace
-- insert into public.org_members (org_id, user_id, role)
-- values ('00000000-0000-0000-0000-000000000001', 'YOUR_USER_ID'::uuid, 'owner')
-- on conflict (org_id, user_id) do update set role = excluded.role;

-- 3) The two accounts
insert into public.accounts (id, org_id, label, tag, kind, brand_color, position)
values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000001',
   'Kyle Matthews', 'KM', 'personal', '#38BDF8', 0),
  ('00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000001',
   'The Matthews Mentality Podcast', 'TMMP', 'show', '#E1306C', 1)
on conflict (id) do nothing;

-- 4) Empty platform connections (so OAuth knows where to attach tokens later)
insert into public.platform_connections (account_id, platform, status)
select a.id, p.k::platform_kind, 'manual_only'::connection_status
from public.accounts a
cross join (values ('spotify'),('captivate'),('youtube'),('instagram'),('tiktok'),('linkedin'),('x')) p(k)
on conflict (account_id, platform) do nothing;

-- 5) Seed the May 6 SM Meeting snapshot
-- KM
insert into public.snapshots
  (org_id, account_id, platform, period_label, period_start, period_end, source,
   followers, growth, views, likes)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
   'instagram','April 22 – May 6','2026-04-22','2026-05-06','import',
   39000, 698, 149400, 2308),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
   'tiktok','April 22 – May 6','2026-04-22','2026-05-06','import',
   13100, 101, 19400, 650),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
   'linkedin','April 22 – May 6','2026-04-22','2026-05-06','import',
   72700, 404, 194000, 1126),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
   'x','April 22 – May 6','2026-04-22','2026-05-06','import',
   null, null, null, 569),
  -- TMMP
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',
   'instagram','April 22 – May 6','2026-04-22','2026-05-06','import',
   1400, 162, 90700, 2225),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',
   'tiktok','April 22 – May 6','2026-04-22','2026-05-06','import',
   617, 117, 115900, null),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',
   'youtube','April 22 – May 6','2026-04-22','2026-05-06','import',
   null, null, 14065, null)
on conflict do nothing;
-- ════════════════════════════════════════════════════════════════════════════
--  Update the default Claude model on `insights` to a currently-available ID.
--  The original `claude-opus-4-6` was never published; current stable Opus is
--  `claude-opus-4-7`. Existing rows are left alone.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.insights
  alter column model set default 'claude-opus-4-7';
-- ════════════════════════════════════════════════════════════════════════════
--  Enable RLS on cron_runs. Only org admins can read their org's job history.
--  Writes are service-role only (cron endpoints use the service-role client),
--  so no write policy is needed.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cron_runs enable row level security;

create policy "cron_runs: admin read"
  on public.cron_runs
  for select
  using (org_id is null or public.is_org_admin(org_id));
-- ════════════════════════════════════════════════════════════════════════════
--  Team invites.
--
--  Admins create a row keyed by lower-cased email; on first sign-up matching
--  that email, a trigger creates the corresponding `org_members` row and
--  stamps `claimed_at`.
-- ════════════════════════════════════════════════════════════════════════════

create table public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,                  -- stored lower-cased
  role member_role not null default 'editor',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  unique (org_id, email)
);

create index org_invites_email_idx on public.org_invites(email) where claimed_at is null;

alter table public.org_invites enable row level security;

create policy "invites: members can read"
  on public.org_invites
  for select
  using (public.is_org_member(org_id));

create policy "invites: admins write"
  on public.org_invites
  for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- ── Claim trigger ──────────────────────────────────────────────────────────
-- When a new auth.users row is created, check for pending invites for that
-- email and (a) insert org_members rows + (b) mark each invite claimed.
--
-- Uses `security definer` because `auth.users` triggers run as a privileged
-- role; we explicitly only INSERT into our own public tables.
create or replace function public.claim_org_invites_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  user_email text;
begin
  user_email := lower(coalesce(new.email, ''));
  if user_email = '' then return new; end if;

  for inv in
    select * from public.org_invites
    where email = user_email and claimed_at is null
  loop
    insert into public.org_members (org_id, user_id, role, invited_email, joined_at)
    values (inv.org_id, new.id, inv.role, user_email, now())
    on conflict (org_id, user_id) do nothing;

    update public.org_invites
    set claimed_at = now(), claimed_by = new.id
    where id = inv.id;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_claim_org_invites on auth.users;
create trigger trg_claim_org_invites
  after insert on auth.users
  for each row execute function public.claim_org_invites_on_signup();
-- ════════════════════════════════════════════════════════════════════════════
--  Token-refresh lease lock + last_refresh_at audit column.
--
--  Why a lease and not pg_try_advisory_xact_lock: Supabase routes the JS
--  client through pgbouncer in transaction mode, so session-scoped advisory
--  locks leak between requests and transaction-scoped ones release the
--  instant the RPC returns — neither serialises the external HTTP refresh
--  call. A short-lived row-level timestamp is the simplest correct primitive.
--
--  Workflow: caller invokes `try_lock_connection_refresh(conn, lease_seconds)`.
--  If it returns a timestamp, the caller owns the lock until that moment.
--  Caller MUST clear `refresh_lock_until` to null when done (or just let it
--  expire). Idle leases self-heal because the condition includes "expired".
-- ════════════════════════════════════════════════════════════════════════════

alter table public.platform_connections
  add column if not exists last_refresh_at timestamptz,
  add column if not exists refresh_lock_until timestamptz;

create index if not exists pc_refresh_lock_idx
  on public.platform_connections(refresh_lock_until)
  where refresh_lock_until is not null;

create or replace function public.try_lock_connection_refresh(
  conn uuid,
  lease_seconds int default 30
) returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.platform_connections
  set refresh_lock_until = now() + make_interval(secs => lease_seconds)
  where id = conn
    and (refresh_lock_until is null or refresh_lock_until < now())
  returning refresh_lock_until;
$$;

revoke all on function public.try_lock_connection_refresh(uuid, int) from public;
grant execute on function public.try_lock_connection_refresh(uuid, int) to service_role;
