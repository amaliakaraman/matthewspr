import { TopBar } from '@/components/layout/TopBar';
import { supabaseServer } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { SpotifyShowForm } from '@/components/dashboard/SpotifyShowForm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SpotifyShowPage({
  params
}: {
  params: { accountId: string };
}) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: account } = await sb
    .from('accounts')
    .select('*')
    .eq('id', params.accountId)
    .maybeSingle();
  if (!account) notFound();

  const { data: conn } = await sb
    .from('platform_connections')
    .select('meta, status, handle')
    .eq('account_id', account.id)
    .eq('platform', 'spotify')
    .maybeSingle();

  const showId =
    conn?.meta && typeof (conn.meta as Record<string, unknown>).show_id === 'string'
      ? ((conn.meta as Record<string, unknown>).show_id as string)
      : undefined;

  return (
    <main className="pb-16">
      <TopBar user={user} />
      <div className="mx-auto max-w-2xl px-9 pt-8">
        <Link
          href="/dashboard/settings"
          className="text-xs text-ink-mute hover:text-ink"
        >
          ← Settings
        </Link>
        <h1 className="mb-1 mt-4 font-display text-3xl font-bold tracking-tight">
          Spotify · {account.label}
        </h1>
        <p className="mb-6 text-sm text-ink-dim">
          Connection status:{' '}
          <span className="font-semibold">{conn?.status || 'not connected'}</span>
          {conn?.handle ? ` · ${conn.handle}` : ''}
        </p>
        <SpotifyShowForm accountId={account.id} initialShowId={showId} />
      </div>
    </main>
  );
}
