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
