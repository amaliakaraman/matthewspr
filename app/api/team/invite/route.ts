import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const Body = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).default('editor')
});

/**
 * POST /api/team/invite
 *
 * Admin creates a pending invite. Once that email signs up, the
 * `claim_org_invites_on_signup` trigger creates the `org_members` row.
 * RLS on `org_invites` enforces that only admins can write.
 */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  // Pick the caller's org (single-org assumption for now).
  const { data: member } = await sb
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'no org' }, { status: 403 });
  if (member.role !== 'owner' && member.role !== 'admin') {
    return NextResponse.json({ error: 'admin role required' }, { status: 403 });
  }

  const email = body.data.email.trim().toLowerCase();
  const { data: invite, error } = await sb
    .from('org_invites')
    .upsert(
      {
        org_id: member.org_id,
        email,
        role: body.data.role,
        invited_by: user.id,
        claimed_at: null,
        claimed_by: null
      },
      { onConflict: 'org_id,email' }
    )
    .select('*')
    .single();
  if (error || !invite) {
    return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invite });
}
