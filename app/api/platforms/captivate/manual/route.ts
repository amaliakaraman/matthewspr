import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/crypto';
import { z } from 'zod';

const Body = z.object({
  account_id: z.string().uuid(),
  api_key: z.string().min(8),
  captivate_user_id: z.string().min(1)
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = Body.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: b.error.message }, { status: 400 });

  const { error } = await sb
    .from('platform_connections')
    .upsert(
      {
        account_id: b.data.account_id,
        platform: 'captivate',
        access_token_enc: encryptToken(b.data.api_key),
        external_id: b.data.captivate_user_id,
        status: 'connected',
        connected_at: new Date().toISOString()
      },
      { onConflict: 'account_id,platform' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
