import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { pullSnapshotForConnection } from '@/lib/snapshot-engine';
import type { Snapshot } from '@/lib/supabase/types';
import { z } from 'zod';

const BodySchema = z.object({
  account_id: z.string().uuid(),
  platform: z.enum(['spotify', 'captivate', 'youtube', 'instagram', 'tiktok', 'linkedin', 'x']),
  period_label: z.string().optional()
});

/** POST /api/snapshots — pull a fresh snapshot for one account×platform. */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = BodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data: account } = await sb
    .from('accounts')
    .select('*')
    .eq('id', body.data.account_id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 });

  const { data: conn } = await sb
    .from('platform_connections')
    .select('*')
    .eq('account_id', body.data.account_id)
    .eq('platform', body.data.platform)
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: 'connection not found' }, { status: 404 });

  const result = await pullSnapshotForConnection(conn, account, {
    source: 'manual',
    periodLabel: body.data.period_label
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/** GET /api/snapshots?account_id=…&platform=… — time-series for charting. */
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get('account_id');
  const platform = req.nextUrl.searchParams.get('platform');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200);
  if (!accountId)
    return NextResponse.json({ error: 'account_id required' }, { status: 400 });

  let q = sb
    .from('snapshots')
    .select('*')
    .eq('account_id', accountId)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (platform) q = q.eq('platform', platform as Snapshot['platform']);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data });
}
