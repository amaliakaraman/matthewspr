import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * POST /api/snapshots/manual — accept hand-entered stats for platforms that
 * lack public APIs (e.g. LinkedIn personal-profile analytics).
 */
const Body = z.object({
  account_id: z.string().uuid(),
  platform: z.enum(['spotify', 'captivate', 'youtube', 'instagram', 'tiktok', 'linkedin', 'x']),
  period_label: z.string().optional(),
  followers: z.number().int().nullable().optional(),
  growth: z.number().int().nullable().optional(),
  views: z.number().int().nullable().optional(),
  impressions: z.number().int().nullable().optional(),
  likes: z.number().int().nullable().optional(),
  profile_visits: z.number().int().nullable().optional(),
  downloads: z.number().int().nullable().optional(),
  plays: z.number().int().nullable().optional(),
  posts: z
    .array(
      z.object({
        title: z.string().optional(),
        permalink: z.string().url().optional(),
        thumb_blob_url: z.string().url().optional(),
        views: z.number().int().nullable().optional(),
        likes: z.number().int().nullable().optional(),
        impressions: z.number().int().nullable().optional(),
        follows: z.number().int().nullable().optional(),
        visits: z.number().int().nullable().optional(),
        downloads: z.number().int().nullable().optional(),
        plays: z.number().int().nullable().optional()
      })
    )
    .optional()
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

  // Every snapshot belongs to a `platform_connections` row. The dashboard's
  // overview loader joins via `snapshots.connection_id`, so a manual snapshot
  // without that FK would never render. Look up the connection (or create a
  // `manual_only` stub if the user hasn't connected this platform yet) so the
  // FK is always populated.
  let connectionId: string | null = null;
  {
    const existing = await sb
      .from('platform_connections')
      .select('id')
      .eq('account_id', account.id)
      .eq('platform', body.data.platform)
      .maybeSingle();
    if (existing.data) {
      connectionId = existing.data.id;
    } else {
      const inserted = await sb
        .from('platform_connections')
        .insert({
          account_id: account.id,
          platform: body.data.platform,
          status: 'manual_only'
        })
        .select('id')
        .single();
      connectionId = inserted.data?.id ?? null;
    }
  }

  const { data: snap, error } = await sb
    .from('snapshots')
    .insert({
      org_id: account.org_id,
      account_id: account.id,
      connection_id: connectionId,
      platform: body.data.platform,
      period_label: body.data.period_label,
      source: 'manual',
      followers: body.data.followers ?? null,
      growth: body.data.growth ?? null,
      views: body.data.views ?? null,
      impressions: body.data.impressions ?? null,
      likes: body.data.likes ?? null,
      profile_visits: body.data.profile_visits ?? null,
      downloads: body.data.downloads ?? null,
      plays: body.data.plays ?? null
    })
    .select('id')
    .single();
  if (error || !snap) return NextResponse.json({ error: error?.message }, { status: 500 });

  if (body.data.posts?.length) {
    await sb.from('posts').insert(
      body.data.posts.map((p, i) => ({
        snapshot_id: snap.id,
        account_id: account.id,
        platform: body.data.platform,
        rank: i + 1,
        is_top: true,
        title: p.title,
        permalink: p.permalink,
        thumb_blob_url: p.thumb_blob_url,
        views: p.views ?? null,
        likes: p.likes ?? null,
        impressions: p.impressions ?? null,
        follows: p.follows ?? null,
        visits: p.visits ?? null,
        downloads: p.downloads ?? null,
        plays: p.plays ?? null
      }))
    );
  }
  return NextResponse.json({ ok: true, snapshot_id: snap.id });
}
