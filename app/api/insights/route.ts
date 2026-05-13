import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateInsight, generateRecapCopy, generateContentStrategy } from '@/lib/ai/insights';
import { z } from 'zod';

const Body = z.object({
  account_id: z.string().uuid(),
  kind: z.enum(['weekly', 'recap_copy', 'content_strategy']).default('weekly'),
  notes: z.string().optional()
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data: account } = await sb
    .from('accounts')
    .select('*')
    .eq('id', body.data.account_id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 });

  // Latest snapshot per platform + prior
  const { data: latest } = await sb
    .from('snapshots')
    .select('*, posts(*)')
    .eq('account_id', account.id)
    .order('captured_at', { ascending: false })
    .limit(50);

  type SnapshotRow = NonNullable<typeof latest>[number];
  const byPlatform = new Map<string, SnapshotRow[]>();
  for (const s of latest || []) {
    if (!byPlatform.has(s.platform)) byPlatform.set(s.platform, []);
    byPlatform.get(s.platform)!.push(s);
  }
  const current: SnapshotRow[] = [];
  const previous: SnapshotRow[] = [];
  for (const arr of byPlatform.values()) {
    if (arr[0]) current.push(arr[0]);
    if (arr[1]) previous.push(arr[1]);
  }
  const periodLabel = current[0]?.period_label || 'this period';

  if (body.data.kind === 'weekly') {
    const out = await generateInsight({
      account,
      currentSnapshots: current as any,
      previousSnapshots: previous as any,
      periodLabel,
      notes: body.data.notes
    });
    const { data: insight } = await sb
      .from('insights')
      .insert({
        org_id: account.org_id,
        account_id: account.id,
        snapshot_id: current[0]?.id,
        kind: 'weekly',
        output_md: out.summary_md,
        output_json: out
      })
      .select('id')
      .single();
    return NextResponse.json({ insight_id: insight?.id, output: out });
  }

  if (body.data.kind === 'recap_copy') {
    const summary = current.map((s) => ({
      platform: s.platform,
      followers: s.followers,
      growth: s.growth,
      topPost: s.posts?.[0]
        ? { title: s.posts[0].title, views: s.posts[0].views, likes: s.posts[0].likes }
        : undefined
    }));
    const out = await generateRecapCopy({ account, periodLabel, platformSummary: summary });
    const { data: insight } = await sb
      .from('insights')
      .insert({
        org_id: account.org_id,
        account_id: account.id,
        kind: 'recap_copy',
        output_md: JSON.stringify(out, null, 2),
        output_json: out
      })
      .select('id')
      .single();
    return NextResponse.json({ insight_id: insight?.id, output: out });
  }

  // content_strategy
  const posts: Array<{ platform: string; title?: string; views?: number; likes?: number }> = [];
  for (const s of current) {
    for (const p of s.posts || []) {
      posts.push({
        platform: s.platform,
        title: p.title || undefined,
        views: p.views || undefined,
        likes: p.likes || undefined
      });
    }
  }
  const out = await generateContentStrategy({ account, recentPosts: posts });
  const { data: insight } = await sb
    .from('insights')
    .insert({
      org_id: account.org_id,
      account_id: account.id,
      kind: 'content_strategy',
      output_md: JSON.stringify(out, null, 2),
      output_json: out
    })
    .select('id')
    .single();
  return NextResponse.json({ insight_id: insight?.id, output: out });
}

/** GET — fetch recent insights for an account. */
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'account_id' }, { status: 400 });
  const { data } = await sb
    .from('insights')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ insights: data });
}
