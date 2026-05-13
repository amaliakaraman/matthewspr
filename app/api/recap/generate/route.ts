import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const Body = z.object({
  account_ids: z.array(z.string().uuid()).min(1),
  template: z.enum(['km-full', 'tmmp-full', 'combined', 'custom']).default('combined'),
  period_label: z.string().optional(),
  title: z.string().optional(),
  notes_md: z.string().optional()
});

/**
 * Stores a recap definition. Actual PDF rendering happens client-side via
 * the dashboard print/export view, or server-side via /api/recap/[id]/pdf
 * (which uses @react-pdf/renderer for a print-perfect 1296×1728 layout).
 */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data: account } = await sb
    .from('accounts')
    .select('org_id')
    .in('id', body.data.account_ids)
    .limit(1)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 });

  const { data: recap, error } = await sb
    .from('recaps')
    .insert({
      org_id: account.org_id,
      title: body.data.title || `${body.data.template} · ${body.data.period_label || ''}`,
      period_label: body.data.period_label,
      template: body.data.template,
      account_ids: body.data.account_ids,
      notes_md: body.data.notes_md,
      created_by: user.id
    })
    .select('id')
    .single();
  if (error || !recap) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json({ recap_id: recap.id });
}
