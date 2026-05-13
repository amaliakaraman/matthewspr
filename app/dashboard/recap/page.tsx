import { supabaseServer } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { RecapStudio } from '@/components/recap/RecapStudio';
import { redirect } from 'next/navigation';
import type { Account, Snapshot, Post } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function RecapPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await sb
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect('/dashboard');

  const { data: accounts } = await sb
    .from('accounts')
    .select('*')
    .eq('org_id', member.org_id)
    .order('position');

  // Pull the most recent snapshot per (account, platform)
  const snapshotsByAccount = new Map<string, Array<Snapshot & { posts: Post[] }>>();
  for (const a of accounts || []) {
    const { data: snaps } = await sb
      .from('snapshots')
      .select('*, posts(*)')
      .eq('account_id', a.id)
      .order('captured_at', { ascending: false })
      .limit(50);
    // pick latest per platform
    const seen = new Set<string>();
    const latestPerPlatform: Array<Snapshot & { posts: Post[] }> = [];
    for (const s of (snaps || []) as Array<Snapshot & { posts: Post[] }>) {
      if (!seen.has(s.platform)) {
        seen.add(s.platform);
        latestPerPlatform.push(s);
      }
    }
    snapshotsByAccount.set(a.id, latestPerPlatform);
  }

  return (
    <main className="pb-16">
      <TopBar user={user} />
      <div className="px-9">
        <div className="mb-6 mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Recap Studio
          </h1>
          <div className="mt-1 text-sm text-ink-dim">
            Auto-generated branded recap reports. Print to PDF, export PNG per
            page, or save the JSON to re-render later.
          </div>
        </div>
        <RecapStudio
          accounts={(accounts ?? []) as Account[]}
          snapshotsByAccount={Object.fromEntries(snapshotsByAccount)}
        />
      </div>
    </main>
  );
}
