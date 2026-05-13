import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const Body = z.object({
  user_id: z.string().uuid(),
  /** When `role` is null the member is removed from the org. */
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).nullable()
});

/**
 * POST /api/team/role — change a member's role (or remove them if role is
 * null). RLS already enforces that only admins can write `org_members`.
 *
 * Guardrails:
 *   - You can't demote/remove yourself.
 *   - You can't remove the last owner.
 */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  if (body.data.user_id === user.id) {
    return NextResponse.json(
      { error: 'cannot change your own role' },
      { status: 400 }
    );
  }

  // Resolve caller's org.
  const { data: caller } = await sb
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!caller) return NextResponse.json({ error: 'no org' }, { status: 403 });

  // Find target row in the same org.
  const { data: target } = await sb
    .from('org_members')
    .select('org_id, user_id, role')
    .eq('user_id', body.data.user_id)
    .eq('org_id', caller.org_id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'member not found' }, { status: 404 });

  // Don't let the last owner be demoted/removed.
  if (target.role === 'owner' && body.data.role !== 'owner') {
    const { data: owners } = await sb
      .from('org_members')
      .select('user_id')
      .eq('org_id', caller.org_id)
      .eq('role', 'owner');
    if ((owners?.length || 0) <= 1) {
      return NextResponse.json(
        { error: 'cannot remove the last owner' },
        { status: 400 }
      );
    }
  }

  if (body.data.role === null) {
    const { error } = await sb
      .from('org_members')
      .delete()
      .eq('user_id', body.data.user_id)
      .eq('org_id', caller.org_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb
    .from('org_members')
    .update({ role: body.data.role })
    .eq('user_id', body.data.user_id)
    .eq('org_id', caller.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
