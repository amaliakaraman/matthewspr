import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { pullSnapshotForConnection } from '@/lib/snapshot-engine';

/**
 * Daily lightweight pull — runs every day at 13:00 UTC.
 * Only fetches platforms with cheap APIs (YouTube + TikTok), so we keep a
 * fine-grained daily follower curve without rate-limiting heavier endpoints.
 *
 * Logs the run into `cron_runs` (same shape as weekly-snapshot).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = supabaseAdmin();

  const { data: run } = await sb
    .from('cron_runs')
    .insert({ job: 'daily-light' })
    .select('id')
    .single();
  const runId = run?.id;

  try {
    const { data: conns } = await sb
      .from('platform_connections')
      .select('*, accounts!inner(*)')
      .in('platform', ['youtube', 'tiktok'])
      .eq('status', 'connected');

    let s = 0;
    let f = 0;
    for (const c of conns || []) {
      const r = await pullSnapshotForConnection(c, c.accounts as any, { source: 'cron' });
      if (r.ok) s += 1;
      else f += 1;
    }

    if (runId) {
      await sb
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: f === 0,
          results: { successes: s, failures: f }
        })
        .eq('id', runId);
    }

    return NextResponse.json({ ok: true, successes: s, failures: f });
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
