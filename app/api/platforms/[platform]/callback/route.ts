import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPlatform } from '@/lib/platforms';
import { encryptToken, verifyState } from '@/lib/crypto';
import { supabaseServer } from '@/lib/supabase/server';
import type { PlatformKind } from '@/lib/supabase/types';

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform as PlatformKind;
  const code = req.nextUrl.searchParams.get('code');
  const stateSigned = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return NextResponse.redirect(new URL(`/dashboard/settings?err=${error}`, req.url));
  if (!code || !stateSigned)
    return NextResponse.redirect(new URL('/dashboard/settings?err=missing_code', req.url));

  const verified = verifyState(stateSigned);
  if (!verified)
    return NextResponse.redirect(new URL('/dashboard/settings?err=bad_state', req.url));
  const { accountId } = JSON.parse(Buffer.from(verified, 'base64url').toString('utf8'));

  const cookieStore = cookies();
  const pkceVerifier = cookieStore.get('kms_pkce')?.value;

  const redirectUri = new URL(`/api/platforms/${platform}/callback`, req.nextUrl.origin).toString();
  const adapter = getPlatform(platform);
  let result;
  try {
    result = await adapter.exchangeCode({ code, pkceVerifier, redirectUri });
  } catch (e: unknown) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?err=${encodeURIComponent(String(e))}`, req.url)
    );
  }

  const sb = supabaseServer();
  await sb
    .from('platform_connections')
    .update({
      handle: result.handle,
      profile_url: result.profileUrl,
      external_id: result.externalId,
      status: 'connected',
      access_token_enc: encryptToken(result.accessToken),
      refresh_token_enc: result.refreshToken ? encryptToken(result.refreshToken) : null,
      token_expires_at: result.expiresAt,
      scope: result.scope,
      connected_at: new Date().toISOString()
    })
    .eq('account_id', accountId)
    .eq('platform', platform);

  cookieStore.set('kms_pkce', '', { maxAge: 0 });
  return NextResponse.redirect(
    new URL(`/dashboard/settings?ok=${platform}`, req.url)
  );
}
