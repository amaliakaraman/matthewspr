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
  const isPodcast = platform === 'captivate' || platform === 'spotify';
  const gradient = isInsta ? meta.gradient! : meta.color;

  // Pull podcast-specific show metadata out of the latest snapshot's `raw`
  // (Captivate stores the full show object there). This lets us swap in a
  // sane podcast-shaped header/tile set when we don't have follower numbers.
  const captivateRaw =
    platform === 'captivate' && latest?.raw && typeof latest.raw === 'object'
      ? (latest.raw as {
          shows?: Array<{
            id: string;
            title: string;
            artwork?: string;
            created?: string;
            episode_count?: number;
            last_episode_title?: string;
            last_episode_published?: string;
          }>;
        })
      : null;
  const captivateShow = captivateRaw?.shows?.[0];

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
            {captivateShow?.artwork ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={captivateShow.artwork}
                alt={captivateShow.title}
                className="h-16 w-16 rounded-[18px] object-cover shadow-[0_12px_30px_rgba(0,0,0,.45)]"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-[18px] text-white shadow-[0_12px_30px_rgba(0,0,0,.45)]"
                style={{ background: gradient }}
              >
                <PlatformIcon kind={platform} className="h-7 w-7" />
              </div>
            )}
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

        {platform === 'captivate' ? (
          <CaptivateTiles
            episodeCount={latest?.episodes ?? captivateShow?.episode_count}
            latestEpisodeTitle={
              captivateShow?.last_episode_title ?? topPosts[0]?.title ?? null
            }
            latestEpisodePublished={
              captivateShow?.last_episode_published ??
              topPosts[0]?.posted_at ??
              null
            }
            showStart={captivateShow?.created ?? null}
            downloads={latest?.downloads ?? null}
            color={meta.color}
          />
        ) : (
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
        )}

        {platform === 'captivate' ? (
          <div className="mt-8 rounded-[18px] border border-white/[.07] bg-white/[.035] p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  Heads up
                </div>
                <h3 className="mt-1 font-display text-base font-bold">
                  Captivate doesn't expose download counts via API
                </h3>
                <p className="mt-2 max-w-xl text-xs text-ink-dim">
                  Their public REST API gives us show + episode metadata, but
                  not listen / download numbers. Pull what you can from
                  Captivate's web dashboard and drop the totals into a manual
                  snapshot — they'll roll up into recaps just like the
                  scraped numbers do.
                </p>
              </div>
              <Link
                href={`/dashboard/snapshots/new?account_id=${account.id}&platform=captivate`}
                className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_25px_-10px_rgba(168,85,247,.7)] hover:opacity-95"
              >
                Add downloads manually
              </Link>
            </div>
          </div>
        ) : (
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
        )}

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold tracking-tight">
              {platform === 'captivate'
                ? 'Recent episodes'
                : `Top posts · ${latest?.period_label || 'latest snapshot'}`}
            </h3>
            {platform === 'captivate' && topPosts.length > 0 && (
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                Newest {topPosts.length}
              </span>
            )}
          </div>
          {platform === 'captivate' ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {topPosts.map((p, i) => (
                <a
                  key={p.id}
                  href={p.permalink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-4 rounded-[14px] border border-white/[.07] bg-white/[.035] p-3 transition-colors hover:bg-white/[.06]"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-white/5">
                    {p.thumb_blob_url ||
                    p.media_url ||
                    captivateShow?.artwork ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={
                          p.thumb_blob_url ||
                          p.media_url ||
                          captivateShow?.artwork ||
                          ''
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl text-ink-mute">
                        ◇
                      </div>
                    )}
                    <div className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                      #{topPosts.length - i}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-ink">
                      {p.title || '—'}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-mute">
                      {p.posted_at && (
                        <span>
                          {format(new Date(p.posted_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      {p.permalink && (
                        <span className="text-ink-dim">Listen ↗</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
              {topPosts.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-ink-mute">
                  No episodes pulled yet. Hit "Pull fresh snapshot" above.
                </div>
              )}
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </main>
  );
}

function CaptivateTiles({
  episodeCount,
  latestEpisodeTitle,
  latestEpisodePublished,
  showStart,
  downloads,
  color
}: {
  episodeCount?: number | null;
  latestEpisodeTitle?: string | null;
  latestEpisodePublished?: string | null;
  showStart?: string | null;
  downloads?: number | null;
  color: string;
}) {
  const ageDays = showStart
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(showStart).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;
  const ageLabel =
    ageDays != null
      ? ageDays >= 365
        ? `${Math.floor(ageDays / 365)}y ${Math.floor((ageDays % 365) / 30)}mo`
        : ageDays >= 30
          ? `${Math.floor(ageDays / 30)}mo`
          : `${ageDays}d`
      : null;
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      <Tile
        label="Episodes"
        value={episodeCount ?? null}
        sub={ageLabel ? `since launch · ${ageLabel}` : 'lifetime'}
        color={color}
      />
      <div className="relative overflow-hidden rounded-[14px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full opacity-30 blur-2xl"
          style={{ background: '#34D399' }}
        />
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          Latest episode
        </div>
        <div className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug text-ink">
          {latestEpisodeTitle || '—'}
        </div>
        <div className="mt-1 text-[11px] text-ink-mute">
          {latestEpisodePublished
            ? format(new Date(latestEpisodePublished), 'MMM d, yyyy')
            : 'no episodes yet'}
        </div>
      </div>
      <Tile
        label="Downloads"
        value={downloads ?? null}
        sub={
          downloads != null
            ? 'manual entry'
            : 'add via "Enter manually"'
        }
        color="#E1306C"
      />
      <div className="relative overflow-hidden rounded-[14px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full opacity-30 blur-2xl"
          style={{ background: '#F59E0B' }}
        />
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          Show launched
        </div>
        <div className="mt-2 font-display text-2xl font-bold tracking-tight text-gradient">
          {showStart ? format(new Date(showStart), 'MMM yyyy') : '—'}
        </div>
        <div className="mt-1 text-[11px] text-ink-mute">
          {ageLabel ? `running ${ageLabel}` : 'unknown'}
        </div>
      </div>
    </div>
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
