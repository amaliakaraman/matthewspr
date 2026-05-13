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
