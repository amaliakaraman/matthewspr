import { TopBar } from '@/components/layout/TopBar';
import { supabaseServer } from '@/lib/supabase/server';
import { PLATFORM_META } from '@/lib/platforms';
import { redirect } from 'next/navigation';
import { CaptivateConnectForm } from '@/components/dashboard/CaptivateConnectForm';
import type { PlatformKind } from '@/lib/supabase/types';

export default async function ConnectPage({
  params,
  searchParams
}: {
  params: { platform: string };
  searchParams: { account_id?: string };
}) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const platform = params.platform as PlatformKind;
  const meta = PLATFORM_META[platform];
  if (!meta) redirect('/dashboard/settings');

  const accountId = searchParams.account_id;
  if (!accountId) redirect('/dashboard/settings');

  return (
    <main className="pb-16">
      <TopBar user={user} />
      <div className="mx-auto max-w-2xl px-9 pt-8">
        <h1 className="mb-4 font-display text-3xl font-bold tracking-tight">
          Connect {meta.name}
        </h1>
        {platform === 'captivate' ? (
          <CaptivateConnectForm accountId={accountId} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-6 text-sm text-ink-dim">
            This platform uses OAuth. Click below to authorize.
            <div className="mt-4">
              <a
                href={`/api/platforms/${platform}/connect?account_id=${accountId}`}
                className="btn-prim inline-block rounded-md px-4 py-2 text-sm font-semibold"
              >
                Authorize {meta.name} →
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
