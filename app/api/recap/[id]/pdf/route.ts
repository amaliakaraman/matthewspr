import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { supabaseServer } from '@/lib/supabase/server';
import { RecapPdfDocument } from '@/lib/recap-pdf';
import type { Account, Snapshot, Post } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/recap/:id/pdf
 *
 * Loads a recap definition and renders a print-perfect PDF using
 * `@react-pdf/renderer`. Streams back `application/pdf`. RLS on `recaps`
 * already guarantees the caller belongs to the recap's org.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: recap } = await sb
    .from('recaps')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!recap) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const accountIds = recap.account_ids || [];
  if (!accountIds.length) {
    return NextResponse.json({ error: 'recap has no accounts' }, { status: 400 });
  }

  const { data: accounts } = await sb
    .from('accounts')
    .select('*')
    .in('id', accountIds)
    .order('position');

  const snapshotsByAccount: Record<string, Array<Snapshot & { posts: Post[] }>> = {};
  for (const a of (accounts || []) as Account[]) {
    const { data: snaps } = await sb
      .from('snapshots')
      .select('*, posts(*)')
      .eq('account_id', a.id)
      .order('captured_at', { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    const latestPerPlatform: Array<Snapshot & { posts: Post[] }> = [];
    for (const s of (snaps || []) as Array<Snapshot & { posts: Post[] }>) {
      if (!seen.has(s.platform)) {
        seen.add(s.platform);
        latestPerPlatform.push(s);
      }
    }
    snapshotsByAccount[a.id] = latestPerPlatform;
  }

  const template = (recap.template || 'combined') as
    | 'km-full'
    | 'tmmp-full'
    | 'combined'
    | 'custom';
  const period = recap.period_label || '';

  const buffer = await renderToBuffer(
    <RecapPdfDocument
      template={template}
      period={period}
      accounts={(accounts || []) as Account[]}
      snapshotsByAccount={snapshotsByAccount}
    />
  );

  const safeName = (recap.title || `recap-${recap.id}`).replace(/[^a-z0-9._-]+/gi, '_');
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
