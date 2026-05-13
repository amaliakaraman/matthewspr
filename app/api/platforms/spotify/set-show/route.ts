import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Persist the Spotify show ID on `platform_connections.meta.show_id`.
 *
 * Accepts either a bare show ID or a `spotify:show:xxx` URI or a full
 * `https://open.spotify.com/show/xxx` URL — all are normalized to the bare ID.
 */
const Body = z.object({
  account_id: z.string().uuid(),
  show_id: z.string().min(1)
});

function normalizeShowId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const uriMatch = trimmed.match(/^spotify:show:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = trimmed.match(/open\.spotify\.com\/show\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const showId = normalizeShowId(body.data.show_id);
  if (!showId) return NextResponse.json({ error: 'invalid Spotify show ID/URI/URL' }, { status: 400 });

  const { data: conn } = await sb
    .from('platform_connections')
    .select('id, meta')
    .eq('account_id', body.data.account_id)
    .eq('platform', 'spotify')
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: 'spotify connection not found' }, { status: 404 });

  const meta = { ...(conn.meta || {}), show_id: showId };
  const { error } = await sb
    .from('platform_connections')
    .update({ meta })
    .eq('id', conn.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, show_id: showId });
}
