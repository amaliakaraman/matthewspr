import { supabaseAdmin } from '@/lib/supabase/server';
import { getPlatform } from '@/lib/platforms';
import { getValidAccessToken, TokenRefreshError } from '@/lib/token-manager';
import type { PlatformConnection, Account, PlatformKind } from '@/lib/supabase/types';
import type { NormalizedSnapshot } from '@/lib/platforms/types';

/**
 * Core snapshot worker — shared by the manual "Pull Now" button and the
 * weekly cron job. All token freshness, refresh races, rotation persistence,
 * and status flips are delegated to `lib/token-manager.ts`.
 */
export async function pullSnapshotForConnection(
  conn: PlatformConnection,
  account: Account,
  opts: { source: 'manual' | 'cron'; periodLabel?: string } = { source: 'manual' }
): Promise<{ ok: true; snapshotId: string } | { ok: false; error: string }> {
  const sb = supabaseAdmin();
  const adapter = getPlatform(conn.platform);

  let accessToken: string;
  let liveConn: PlatformConnection;
  try {
    const valid = await getValidAccessToken(conn.id);
    accessToken = valid.accessToken;
    liveConn = valid.connection;
  } catch (e) {
    if (e instanceof TokenRefreshError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: 'Token refresh failed: ' + String(e) };
  }
  conn = liveConn;

  let normalized: NormalizedSnapshot;
  try {
    normalized = await adapter.pullSnapshot({
      accessToken,
      externalId: conn.external_id || undefined,
      handle: conn.handle || undefined,
      topN: 8,
      meta: conn.meta
    });
  } catch (e: unknown) {
    // If the pull failed with an auth-shaped error (401/403) AND this adapter
    // can't refresh (LinkedIn, Captivate), the connection is effectively
    // unrecoverable without a manual reconnect. Park it at `manual_only` so
    // the UI stops nagging with a red "error" pill and the user can keep
    // entering numbers through the Manual Snapshot form.
    const msg = String(e);
    const isAuthError = /\b40[13]\b/.test(msg);
    const nextStatus =
      isAuthError && !adapter.refresh ? 'manual_only' : 'error';
    await sb
      .from('platform_connections')
      .update({ status: nextStatus, last_pull_error: msg })
      .eq('id', conn.id);
    return { ok: false, error: 'Pull failed: ' + msg };
  }

  // Compute growth vs last snapshot
  const { data: prior } = await sb
    .from('snapshots')
    .select('followers')
    .eq('account_id', account.id)
    .eq('platform', conn.platform)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const growth =
    normalized.followers != null && prior?.followers != null
      ? normalized.followers - prior.followers
      : null;

  const { data: snap, error: snapErr } = await sb
    .from('snapshots')
    .insert({
      org_id: account.org_id,
      account_id: account.id,
      connection_id: conn.id,
      platform: conn.platform,
      captured_at: normalized.capturedAt,
      period_label: opts.periodLabel,
      source: opts.source,
      followers: normalized.followers ?? null,
      growth,
      views: normalized.views ?? null,
      impressions: normalized.impressions ?? null,
      likes: normalized.likes ?? null,
      comments: normalized.comments ?? null,
      shares: normalized.shares ?? null,
      saves: normalized.saves ?? null,
      watch_seconds: normalized.watchSeconds ?? null,
      avg_watch_seconds: normalized.avgWatchSeconds ?? null,
      engagement_rate: normalized.engagementRate ?? null,
      profile_visits: normalized.profileVisits ?? null,
      downloads: normalized.downloads ?? null,
      plays: normalized.plays ?? null,
      unique_listeners: normalized.uniqueListeners ?? null,
      episodes: normalized.episodes ?? null,
      raw: normalized.raw as Record<string, unknown>
    })
    .select('id')
    .single();
  if (snapErr || !snap) return { ok: false, error: snapErr?.message || 'insert failed' };

  // Posts
  if (normalized.topPosts.length) {
    await sb.from('posts').insert(
      normalized.topPosts.map((p, i) => ({
        snapshot_id: snap.id,
        account_id: account.id,
        platform: conn.platform,
        external_id: p.externalId,
        posted_at: p.postedAt,
        title: p.title,
        caption: p.caption,
        permalink: p.permalink,
        media_url: p.mediaUrl,
        thumb_blob_url: p.thumbUrl,
        is_top: true,
        rank: i + 1,
        views: p.views ?? null,
        impressions: p.impressions ?? null,
        likes: p.likes ?? null,
        comments: p.comments ?? null,
        shares: p.shares ?? null,
        saves: p.saves ?? null,
        follows: p.follows ?? null,
        visits: p.visits ?? null,
        watch_seconds: p.watchSeconds ?? null,
        avg_watch_seconds: p.avgWatchSeconds ?? null,
        downloads: p.downloads ?? null,
        plays: p.plays ?? null
      }))
    );
  }

  await sb
    .from('platform_connections')
    .update({
      last_pull_at: new Date().toISOString(),
      last_pull_error: null,
      status: 'connected',
      handle: normalized.handle ?? conn.handle,
      profile_url: normalized.profileUrl ?? conn.profile_url,
      external_id: normalized.externalId ?? conn.external_id
    })
    .eq('id', conn.id);

  return { ok: true, snapshotId: snap.id };
}

export async function pullAllForOrg(orgId: string): Promise<{
  successes: number;
  failures: number;
  errors: Array<{ accountId: string; platform: PlatformKind; error: string }>;
}> {
  const sb = supabaseAdmin();
  const { data: accounts } = await sb.from('accounts').select('*').eq('org_id', orgId);
  if (!accounts?.length) return { successes: 0, failures: 0, errors: [] };

  let s = 0,
    f = 0;
  const errors: Array<{ accountId: string; platform: PlatformKind; error: string }> = [];

  for (const a of accounts) {
    // Include `expired` and `error` rows so a transient failure heals itself
    // on the next cron — the token manager will re-attempt refresh and flip
    // the status back to `connected` if possible. Skip only the states that
    // explicitly require human action.
    const { data: conns } = await sb
      .from('platform_connections')
      .select('*')
      .eq('account_id', a.id)
      .in('status', ['connected', 'expired', 'error']);
    for (const c of conns || []) {
      const r = await pullSnapshotForConnection(c, a, { source: 'cron' });
      if (r.ok) s += 1;
      else {
        f += 1;
        errors.push({ accountId: a.id, platform: c.platform, error: r.error });
      }
    }
  }
  return { successes: s, failures: f, errors };
}
