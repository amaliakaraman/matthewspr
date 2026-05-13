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
