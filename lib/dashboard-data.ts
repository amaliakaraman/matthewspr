import { supabaseServer } from '@/lib/supabase/server';
import type { Account, PlatformKind, PlatformConnection, Snapshot, Post } from '@/lib/supabase/types';
import type { PlatformCardData } from '@/components/dashboard/PlatformCard';

/**
 * Single helper that loads everything the overview page needs in two
 * round-trips (down from ~30 in the original N+1 implementation):
 *
 *   1) accounts for the org
 *   2) all platform_connections for those accounts, nested with their
 *      latest two snapshots and the top posts of the latest snapshot
 *
 * Supabase's relational select handles the nesting; the per-platform "latest
 * two" cap is applied in JS after the fact since PostgREST doesn't yet
 * support `LIMIT N PER PARTITION`.
 */
type SnapshotWithPosts = Snapshot & { posts: Post[] };

export async function loadOverview() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await sb
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return { user, orgId: null, accounts: [], cards: new Map<string, PlatformCardData[]>() };

  const { data: accounts } = await sb
    .from('accounts')
    .select('*')
    .eq('org_id', orgId)
    .order('position');

  const accountIds = (accounts || []).map((a) => a.id);
  const cards = new Map<string, PlatformCardData[]>();

  if (!accountIds.length) {
    return { user, orgId, accounts: (accounts || []) as Account[], cards };
  }

  // One trip: every connection across the org's accounts, with each
  // connection's snapshots+posts nested. We then slice in-memory to
  // "latest 2 per (account, platform)" and "top 6 posts of latest".
  const { data: connections } = await sb
    .from('platform_connections')
    .select('*, snapshots(*, posts(*))')
    .in('account_id', accountIds)
    .order('captured_at', { foreignTable: 'snapshots', ascending: false });

  for (const a of accounts || []) {
    cards.set(a.id, []);
  }

  for (const cRaw of connections || []) {
    const c = cRaw as unknown as PlatformConnection & { snapshots?: SnapshotWithPosts[] };
    const snaps = (c.snapshots || []).slice(0, 2);
    const latest = snaps[0] || null;
    const prior = snaps[1] || null;
    const topPosts: Post[] = latest
      ? (latest.posts || [])
          .filter((p) => p.is_top)
          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, 6)
      : [];

    const arr = cards.get(c.account_id) || [];
    arr.push({
      platform: c.platform as PlatformKind,
      handle: c.handle,
      profileUrl: c.profile_url,
      status: c.status,
      latest,
      prior,
      topPosts
    });
    cards.set(c.account_id, arr);
  }

  return { user, orgId, accounts: (accounts || []) as Account[], cards };
}
