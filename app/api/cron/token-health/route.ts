import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getValidAccessToken, TokenRefreshError } from '@/lib/token-manager';
import type { PlatformConnection, PlatformKind } from '@/lib/supabase/types';

/**
 * Daily token-health cron. Walks every refreshable connection and asks the
 * token manager to refresh anything inside its per-platform lead window. Any
 * connection that flips out of `connected` triggers an alert via
 * `notifyConnectionFlip` inside the manager.
 *
 * Schedule: `30 4 * * *` (04:30 UTC) — offset from `daily-light` (13:00 UTC)
 * so the two crons don't pile up. See `vercel.json`.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: run } = await sb
    .from('cron_runs')
    .insert({ job: 'token-health' })
    .select('id')
    .single();
  const runId = run?.id;

  try {
    // We deliberately include `expired` and `error` rows: the manager will
    // try to refresh them and flip back to `connected` on success. Skip only
    // states that explicitly require human action.
    const { data: conns } = await sb
      .from('platform_connections')
      .select('*')
      .in('status', ['connected', 'expired', 'error']);

    let ok = 0;
    let fail = 0;
    const failures: Array<{
      connection_id: string;
      platform: PlatformKind;
      error: string;
    }> = [];

    for (const c of (conns || []) as PlatformConnection[]) {
      if (!c.access_token_enc) continue;
      try {
        await getValidAccessToken(c.id);
        ok += 1;
      } catch (e) {
        fail += 1;
        const msg = e instanceof TokenRefreshError ? e.message : String(e);
        failures.push({
          connection_id: c.id,
          platform: c.platform,
          error: msg
        });
      }
    }

    if (runId) {
      await sb
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: fail === 0,
          results: { ok, fail, failures }
        })
        .eq('id', runId);
    }

    return NextResponse.json({ ok: true, refreshed: ok, failures: fail, errors: failures });
  } catch (e) {
    if (runId) {
      await sb
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          message: String(e)
        })
        .eq('id', runId);
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
