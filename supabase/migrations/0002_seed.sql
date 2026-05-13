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
