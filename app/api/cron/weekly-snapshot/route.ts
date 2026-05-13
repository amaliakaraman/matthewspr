import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { pullAllForOrg } from '@/lib/snapshot-engine';

/**
 * Vercel scheduled job — fires every Monday 9am Eastern (see vercel.json).
 * Pulls fresh snapshots for every org, then triggers AI insights.
 *
 * Auth: requires header `Authorization: Bearer ${CRON_SECRET}` (Vercel sets
 * this automatically when the function is invoked via the schedule).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: orgs } = await sb.from('orgs').select('id');
  const results: Array<{ org: string; r: unknown }> = [];

  for (const o of orgs || []) {
    const { data: run } = await sb
      .from('cron_runs')
      .insert({ job: 'weekly-snapshot', org_id: o.id })
      .select('id')
      .single();
    try {
      const r = await pullAllForOrg(o.id);
      await sb
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: r.failures === 0,
          results: r
        })
        .eq('id', run?.id || '');
      results.push({ org: o.id, r });
    } catch (e) {
      await sb
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          message: String(e)
        })
        .eq('id', run?.id || '');
    }
  }
  return NextResponse.json({ ok: true, results });
}
