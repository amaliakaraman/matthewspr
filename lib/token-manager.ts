import { supabaseAdmin } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { getPlatform } from '@/lib/platforms';
import { notifyConnectionFlip } from '@/lib/alerts';
import type {
  ConnectionStatus,
  PlatformConnection,
  PlatformKind
} from '@/lib/supabase/types';

/**
 * The single helper every code path uses to get a usable access token for a
 * platform connection. Handles preemptive refresh, lease-based locking (so
 * concurrent refreshes can't race), rotation persistence, status flips, and
 * alerting.
 *
 * Why lease-locking rather than `pg_try_advisory_xact_lock`: Supabase pools
 * Postgres connections through pgbouncer, so session-scoped advisory locks
 * leak across requests and transaction-scoped ones release the instant the
 * RPC returns (i.e. they don't actually serialize anything around the
 * external HTTP refresh call). A short-lived row-level lease is the simplest
 * correct primitive given those constraints.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How early before expiry to preemptively refresh. Sized to the platform's
 * token TTL and the practical cron cadence we run against it:
 *   - Spotify / YouTube: 1h tokens → 5m lead
 *   - X: 2h tokens, refresh token rotates every call → 5m lead
 *   - TikTok: 24h tokens, refresh rotates → 10m lead
 *   - Instagram: ~60d long-lived → re-extend any time within 14d of expiry
 *   - LinkedIn: 60d, no refresh flow → 0 (caller will get a stale token and
 *     the adapter's pull will route to `manual_only` on 401)
 *   - Captivate: API key, never expires
 */
export const REFRESH_LEAD_MS: Record<PlatformKind, number> = {
  spotify: 5 * MINUTE,
  youtube: 5 * MINUTE,
  x: 5 * MINUTE,
  tiktok: 10 * MINUTE,
  instagram: 14 * DAY,
  linkedin: 0,
  captivate: 0
};

const LEASE_SECONDS = 30;
const LEASE_POLL_MS = 250;
const LEASE_MAX_WAITS = 30; // ~7.5s worst-case wait for a contended lock

export interface ValidToken {
  accessToken: string;
  connection: PlatformConnection;
}

export class TokenRefreshError extends Error {
  readonly status: ConnectionStatus;
  constructor(message: string, status: ConnectionStatus) {
    super(message);
    this.name = 'TokenRefreshError';
    this.status = status;
  }
}

async function readConn(id: string): Promise<PlatformConnection | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('platform_connections')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as PlatformConnection | null) ?? null;
}

function needsRefresh(conn: PlatformConnection): boolean {
  if (!conn.token_expires_at) return false;
  const lead = REFRESH_LEAD_MS[conn.platform] ?? 0;
  return new Date(conn.token_expires_at).getTime() < Date.now() + lead;
}

async function tryLock(id: string): Promise<boolean> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('try_lock_connection_refresh', {
    conn: id,
    lease_seconds: LEASE_SECONDS
  });
  if (error) {
    // Migration not yet applied: degrade to no-lock so dev/test isn't blocked.
    if ((error.message || '').includes('does not exist')) return true;
    throw new Error(`try_lock_connection_refresh: ${error.message}`);
  }
  return data != null;
}

async function waitForLock(id: string): Promise<boolean> {
  for (let i = 0; i < LEASE_MAX_WAITS; i++) {
    if (await tryLock(id)) return true;
    await new Promise((r) => setTimeout(r, LEASE_POLL_MS));
  }
  return false;
}

async function releaseLockBestEffort(id: string): Promise<void> {
  const sb = supabaseAdmin();
  try {
    await sb
      .from('platform_connections')
      .update({ refresh_lock_until: null })
      .eq('id', id);
  } catch {
    /* lease will expire on its own */
  }
}

async function markFailed(
  conn: PlatformConnection,
  status: ConnectionStatus,
  error: string
): Promise<void> {
  const sb = supabaseAdmin();
  await sb
    .from('platform_connections')
    .update({
      status,
      last_pull_error: error,
      refresh_lock_until: null
    })
    .eq('id', conn.id);
  if (conn.status !== status) {
    await notifyConnectionFlip({
      connectionId: conn.id,
      platform: conn.platform,
      handle: conn.handle,
      fromStatus: conn.status,
      toStatus: status,
      note: error
    });
  }
}

/**
 * Returns a fresh access token for the given connection. Refreshes
 * preemptively (per-platform lead time), serialises concurrent refreshes via
 * a row-level lease, persists rotated refresh tokens before doing anything
 * else, and updates connection status on failure.
 *
 * Throws `TokenRefreshError` with a meaningful `status` if the token cannot
 * be made valid. Callers should translate that into a "Reconnect" prompt.
 */
export async function getValidAccessToken(
  connectionId: string
): Promise<ValidToken> {
  let conn = await readConn(connectionId);
  if (!conn) {
    throw new TokenRefreshError(`Connection ${connectionId} not found`, 'error');
  }
  if (!conn.access_token_enc) {
    throw new TokenRefreshError(
      'Connection has no access token; reconnect required',
      'manual_only'
    );
  }

  if (!needsRefresh(conn)) {
    return { accessToken: decryptToken(conn.access_token_enc), connection: conn };
  }

  const adapter = getPlatform(conn.platform);

  // Adapters without `refresh()` (LinkedIn personal, Captivate API key) can't
  // be auto-renewed. Hand back the current token; if it's truly dead the
  // adapter's pull will 401 and the snapshot engine will park the connection.
  if (!adapter.refresh) {
    return { accessToken: decryptToken(conn.access_token_enc), connection: conn };
  }

  if (!conn.refresh_token_enc) {
    await markFailed(conn, 'expired', 'No refresh token stored');
    throw new TokenRefreshError(
      'No refresh token stored; reconnect required',
      'expired'
    );
  }

  const haveLock = await waitForLock(connectionId);
  if (!haveLock) {
    const latest = (await readConn(connectionId)) ?? conn;
    if (!needsRefresh(latest) && latest.access_token_enc) {
      return {
        accessToken: decryptToken(latest.access_token_enc),
        connection: latest
      };
    }
    throw new TokenRefreshError('Refresh lock contention timed out', 'error');
  }

  try {
    conn = (await readConn(connectionId)) ?? conn;
    if (!needsRefresh(conn) && conn.access_token_enc) {
      return { accessToken: decryptToken(conn.access_token_enc), connection: conn };
    }
    if (!conn.refresh_token_enc) {
      await markFailed(conn, 'expired', 'No refresh token stored');
      throw new TokenRefreshError('No refresh token stored', 'expired');
    }

    let refreshed;
    try {
      refreshed = await adapter.refresh!({
        refreshToken: decryptToken(conn.refresh_token_enc)
      });
    } catch (e: unknown) {
      const msg = String(e);
      // 400/invalid_grant or 401 = refresh token revoked or expired. Anything
      // else is treated as transient (network, rate limit) so the next cron
      // run can retry without forcing a re-auth.
      const isFatal = /\b40[013]\b|invalid_grant|invalid_token/i.test(msg);
      const nextStatus: ConnectionStatus = isFatal ? 'expired' : 'error';
      await markFailed(conn, nextStatus, `Refresh failed: ${msg}`);
      throw new TokenRefreshError(`Refresh failed: ${msg}`, nextStatus);
    }

    // Rotation safety: X (and TikTok) invalidate the old refresh token the
    // instant the response is generated. Persisting the new one BEFORE we do
    // anything else is non-negotiable.
    const now = new Date().toISOString();
    const update: Partial<PlatformConnection> = {
      access_token_enc: encryptToken(refreshed.accessToken),
      refresh_token_enc: refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : conn.refresh_token_enc,
      token_expires_at: refreshed.expiresAt ?? null,
      status: 'connected',
      last_pull_error: null,
      last_refresh_at: now,
      refresh_lock_until: null
    };
    const sb = supabaseAdmin();
    const { error } = await sb
      .from('platform_connections')
      .update(update)
      .eq('id', conn.id);
    if (error) {
      throw new TokenRefreshError(
        `Persist refreshed token failed: ${error.message}`,
        'error'
      );
    }

    const merged: PlatformConnection = { ...conn, ...update } as PlatformConnection;
    if (conn.status !== 'connected') {
      await notifyConnectionFlip({
        connectionId: conn.id,
        platform: conn.platform,
        handle: conn.handle,
        fromStatus: conn.status,
        toStatus: 'connected',
        note: 'Token refreshed successfully'
      });
    }
    return { accessToken: refreshed.accessToken, connection: merged };
  } finally {
    await releaseLockBestEffort(connectionId);
  }
}
