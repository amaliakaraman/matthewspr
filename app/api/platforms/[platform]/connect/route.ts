import { NextRequest, NextResponse } from 'next/server';
import { getPlatform, PLATFORM_META } from '@/lib/platforms';
import { signState, pkcePair } from '@/lib/crypto';
import { supabaseServer } from '@/lib/supabase/server';
import type { PlatformKind } from '@/lib/supabase/types';
import { cookies } from 'next/headers';

const ALLOWED: PlatformKind[] = [
  'spotify',
  'captivate',
  'youtube',
  'instagram',
  'tiktok',
  'linkedin',
  'x'
];

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform as PlatformKind;
  if (!ALLOWED.includes(platform)) {
    return NextResponse.json({ error: 'unknown platform' }, { status: 404 });
  }
  const accountId = req.nextUrl.searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 });

  // Auth
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  // Make sure user has access to account
  const { data: account } = await sb.from('accounts').select('id, org_id').eq('id', accountId).maybeSingle();
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 });

  const adapter = getPlatform(platform);
  const meta = PLATFORM_META[platform];

  if (!meta.requiresOAuth) {
    // Captivate — render the API-key paste form
    return NextResponse.redirect(
      new URL(`/dashboard/settings/connect/${platform}?account_id=${accountId}`, req.url)
    );
  }

  // OAuth flow
  const pkce = pkcePair();
  const stateRaw = JSON.stringify({ accountId, platform, ts: Date.now() });
  const state = signState(Buffer.from(stateRaw).toString('base64url'));

  const cookieStore = cookies();
  cookieStore.set('kms_pkce', pkce.verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600
  });

  const redirectUri = new URL(`/api/platforms/${platform}/callback`, req.nextUrl.origin).toString();
  const url = adapter.authorizeUrl({ state, pkceChallenge: pkce.challenge, redirectUri });
  return NextResponse.redirect(url);
}
