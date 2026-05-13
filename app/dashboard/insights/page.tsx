import { supabaseServer } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { redirect } from 'next/navigation';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';

export const dynamic = 'force-dynamic';

export default async function InsightsPage({
  searchParams
}: {
  searchParams: { acct?: string };
}) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgMember } = await sb
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!orgMember) redirect('/dashboard');

  const { data: accounts } = await sb
    .from('accounts')
    .select('*')
    .eq('org_id', orgMember.org_id)
    .order('position');
  const account = accounts?.find((a) => a.id === searchParams.acct) || accounts?.[0];
  if (!account) redirect('/dashboard');

  const { data: insights } = await sb
    .from('insights')
    .select('*')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <main className="pb-20">
      <TopBar user={user} />
      <div className="px-9">
        <div className="mb-6 mt-4 flex items-center gap-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_#34D399] animate-pulse-dot" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              AI Insights
            </h1>
            <div className="text-xs text-ink-mute">
              Claude analyzes every snapshot. Generate a new report below.
            </div>
          </div>
        </div>
        <InsightsPanel
          accounts={accounts || []}
          activeAccountId={account.id}
          existing={insights || []}
        />
      </div>
    </main>
  );
}
