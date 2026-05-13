import { supabaseServer } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { PlatformIcon } from '@/components/dashboard/PlatformIcon';
import { PLATFORM_META } from '@/lib/platforms';
import { GrowthChart, type GrowthPoint } from '@/components/charts/GrowthChart';
import { formatNum } from '@/lib/utils';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { PlatformKind, Snapshot, Post } from '@/lib/supabase/types';
import Link from 'next/link';
import { PullNowButton } from '@/components/dashboard/PullNowButton';

export default async function PlatformPage({
  params
}: {
  params: { accountId: string; platform: string };
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
  const platform = params.platform as PlatformKind;
  const meta = PLATFORM_META[platform];
  if (!meta) notFound();

  const { data: snapshots } = await sb
    .from('snapshots')
    .select('*')
    .eq('account_id', account.id)
    .eq('platform', platform)
    .order('captured_at', { ascending: true })
    .limit(60);

  const { data: connection } = await sb
    .from('platform_connections')
    .select('*')
    .eq('account_id', account.id)
    .eq('platform', platform)
    .maybeSingle();

  const latest = (snapshots?.at(-1) as Snapshot) || null;
  const prior = (snapshots?.at(-2) as Snapshot) || null;
  let topPosts: Post[] = [];
  if (latest) {
    const { data } = await sb
      .from('posts')
      .select('*')
      .eq('snapshot_id', latest.id)
      .order('rank', { ascending: true })
      .limit(12);
    topPosts = (data as Post[]) || [];
  }

  const series: GrowthPoint[] = (snapshots || []).map((s) => ({
    date: format(new Date(s.captured_at), 'MMM d'),
    followers: s.followers,
    growth: s.growth
  }));

  const isInsta = platform === 'instagram';
  const gradient = isInsta ? meta.gradient! : meta.color;

  return (
    <main className="pb-20">
      <TopBar user={user} />

      <div className="px-9 pt-4">
        <Link
          href={`/dashboard?acct=${account.id}`}
          className="text-xs text-ink-mute hover:text-ink"
        >
          ← {account.label}
        </Link>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-[18px] text-white shadow-[0_12px_30px_rgba(0,0,0,.45)]"
              style={{ background: gradient }}
            >
              <PlatformIcon kind={platform} className="h-7 w-7" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                {account.tag} · {meta.name}
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight">
                {connection?.handle || meta.name}
              </h1>
              {connection?.profile_url && (
                <a
                  href={connection.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ink-dim hover:text-ink"
                >
                  {connection.profile_url} ↗
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/snapshots/new?account_id=${account.id}&platform=${platform}`}
              className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-semibold text-ink-dim hover:bg-white/10"
            >
              Enter manually
            </Link>
            <PullNowButton
              accountId={account.id}
              platform={platform}
              connected={connection?.status === 'connected'}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile
            label={meta.fLabel}
            value={latest?.followers}
            sub={
              prior?.followers != null && latest?.followers != null
                ? `${latest.followers > prior.followers ? '+' : ''}${formatNum(latest.followers - prior.followers)} vs last`
                : '—'
            }
            color={meta.color}
          />
          <Tile
            label="Growth · period"
            value={latest?.growth}
            sub="vs prior snapshot"
            color="#34D399"
          />
          <Tile
            label={meta.metrics[0]}
            value={latest?.views ?? latest?.impressions ?? latest?.plays}
            sub={latest?.period_label || '—'}
            color="#E1306C"
          />
          <Tile
            label={meta.metrics[1]}
            value={latest?.likes}
            sub={meta.metrics[2]}
            color="#F59E0B"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[18px] border border-white/[.07] bg-white/[.035] p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                Followers · all time
              </h3>
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                {series.length} snapshots
              </span>
            </div>
            <GrowthChart
              data={series}
              color={meta.color}
              metric="followers"
            />
          </div>
          <div className="rounded-[18px] border border-white/[.07] bg-white/[.035] p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                Period growth
              </h3>
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                Δ followers per snapshot
              </span>
            </div>
            <GrowthChart data={series} color="#34D399" metric="growth" />
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold tracking-tight">
              Top posts · {latest?.period_label || 'latest snapshot'}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {topPosts.map((p) => (
              <a
                key={p.id}
                href={p.permalink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-[14px] border border-white/[.07] bg-white/[.035] transition-transform hover:-translate-y-0.5"
              >
                <div className="relative aspect-[9/16] bg-white/5">
                  {p.thumb_blob_url || p.media_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.thumb_blob_url || p.media_url || ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-ink-mute">
                      ◇
                    </div>
                  )}
                </div>
                <div className="space-y-1 px-3 py-2.5">
                  <div className="line-clamp-1 text-xs text-ink">
                    {p.title || '—'}
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-mute">
                    <span>{formatNum(p.views || p.impressions || 0)}</span>
                    <span>{formatNum(p.likes || 0)} ♡</span>
                  </div>
                </div>
              </a>
            ))}
            {topPosts.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-ink-mute">
                No posts logged yet. Run a pull or upload screenshots manually.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Tile({
  label,
  value,
  sub,
  color
}: {
  label: string;
  value?: number | null;
  sub?: string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: color }}
      />
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold tracking-tight text-gradient">
        {value != null ? formatNum(value) : '—'}
      </div>
      <div className="mt-1 text-[11px] text-ink-mute">{sub}</div>
    </div>
  );
}
