import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyState } from '@/lib/crypto';

/**
 * POST /api/auth/signout
 *
 * CSRF protection is HMAC-based (double-submit, but stateless):
 *   • TopBar renders a hidden `_csrf` field equal to `signState(user.id)`.
 *   • This route verifies the HMAC against the currently-authenticated user.
 *   • A third-party page can't forge this token without `TOKEN_ENCRYPTION_KEY`.
 *
 * If no user is authenticated, redirect straight to /login (nothing to sign
 * out from).
 */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  let token = '';
  try {
    const form = await req.formData();
    token = (form.get('_csrf') as string | null) || '';
  } catch {
    /* JSON / empty body → token stays empty → fail closed below */
  }
  const signedUserId = verifyState(token);
  if (signedUserId !== user.id) {
    return NextResponse.json({ error: 'invalid csrf token' }, { status: 403 });
  }

  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url));
}
