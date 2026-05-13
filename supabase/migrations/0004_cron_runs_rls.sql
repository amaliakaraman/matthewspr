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
