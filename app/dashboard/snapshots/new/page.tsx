import { supabaseServer } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { redirect } from 'next/navigation';
import { ManualSnapshotForm } from '@/components/dashboard/ManualSnapshotForm';
import type { Account, PlatformKind } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const PLATFORMS = new Set([
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'youtube',
  'spotify',
  'captivate'
]);

export default async function NewManualSnapshotPage({
  searchParams
}: {
  searchParams: { account_id?: string; platform?: string };
}) {
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

  const defaultPlatform =
    searchParams.platform && PLATFORMS.has(searchParams.platform)
      ? (searchParams.platform as PlatformKind)
      : undefined;

  return (
    <main className="pb-20">
      <TopBar user={user} />
      <div className="mx-auto max-w-4xl px-9 pt-4">
        <div className="mb-6 mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Manual snapshot
          </h1>
          <p className="mt-1 text-sm text-ink-dim">
            For platforms without a working API pull — LinkedIn personal posts,
            Spotify for Podcasters, anything else. Numbers will appear on the
            dashboard as soon as you save.
          </p>
        </div>
        <ManualSnapshotForm
          accounts={(accounts || []) as Account[]}
          defaultAccountId={searchParams.account_id}
          defaultPlatform={defaultPlatform}
        />
      </div>
    </main>
  );
}
