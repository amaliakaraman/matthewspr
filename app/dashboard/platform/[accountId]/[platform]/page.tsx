import { supabaseServer } from '@/lib/supabase/server';
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
    <main className="px-12 pb-20 pt-7">
      <div>
        <Link
          href={`/dashboard?acct=${account.id}`}
          className="text-[12.5px] font-semibold text-mx-muted hover:text-mx-title"
        >
          ← {account.label}
        </Link>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {captivateShow?.artwork ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={captivateShow.artwork}
                alt={captivateShow.title}
                className="h-16 w-16 rounded-[18px] object-cover shadow-card"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-[18px] text-white shadow-glow"
                style={{ background: gradient }}
              >
                <PlatformIcon kind={platform} className="h-7 w-7" />
              </div>
            )}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
                {account.tag} · {meta.name}
              </div>
              <h1 className="text-[32px] font-bold tracking-tight text-mx-title">
                {connection?.handle || meta.name}
              </h1>
              {connection?.profile_url && (
                <a
                  href={connection.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] text-mx-link hover:underline"
                >
                  {connection.profile_url} ↗
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/snapshots/new?account_id=${account.id}&platform=${platform}`}
              className="rounded-lg border border-mx-field bg-white px-4 py-2.5 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover"
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
          <div className="mt-8 rounded-[16px] border border-mx-line bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
                  Heads up
                </div>
                <h3 className="mt-1 text-base font-bold text-mx-title">
                  Captivate doesn't expose download counts via API
                </h3>
                <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mx-secondary">
                  Their public REST API gives us show + episode metadata, but
                  not listen / download numbers. Pull what you can from
                  Captivate's web dashboard and drop the totals into a manual
                  snapshot — they'll roll up into recaps just like the
                  scraped numbers do.
                </p>
              </div>
              <Link
                href={`/dashboard/snapshots/new?account_id=${account.id}&platform=captivate`}
                className="shrink-0 rounded-lg bg-mx-blue px-4 py-2.5 text-[12.5px] font-bold text-white shadow-glow hover:bg-mx-blueDeep"
              >
                Add downloads manually
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[16px] border border-mx-line bg-white p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-mx-title">
                  Followers · all time
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-mx-label">
                  {series.length} snapshots
                </span>
              </div>
              <GrowthChart data={series} color={meta.color} metric="followers" />
            </div>
            <div className="rounded-[16px] border border-mx-line bg-white p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-mx-title">
                  Period growth
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-mx-label">
                  Δ followers per snapshot
                </span>
              </div>
              <GrowthChart data={series} color="#1D9669" metric="growth" />
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight text-mx-title">
              {platform === 'captivate'
                ? 'Recent episodes'
                : `Top posts · ${latest?.period_label || 'latest snapshot'}`}
            </h3>
            {platform === 'captivate' && topPosts.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-mx-label">
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
                  className="flex gap-4 rounded-[14px] border border-mx-line bg-white p-3 shadow-card transition-colors hover:bg-mx-hover"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-mx-lineSoft">
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
                      <div className="flex h-full w-full items-center justify-center text-xl text-mx-muted">
                        ◇
                      </div>
                    )}
                    <div className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                      #{topPosts.length - i}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold text-mx-title">
                      {p.title || '—'}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-mx-muted">
                      {p.posted_at && (
                        <span>
                          {format(new Date(p.posted_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      {p.permalink && (
                        <span className="font-semibold text-mx-link">Listen ↗</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
              {topPosts.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-mx-field p-12 text-center text-sm text-mx-muted">
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
                  className="overflow-hidden rounded-[14px] border border-mx-line bg-white shadow-card transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[9/16] bg-mx-lineSoft">
                    {p.thumb_blob_url || p.media_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.thumb_blob_url || p.media_url || ''}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-mx-muted">
                        ◇
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 px-3 py-2.5">
                    <div className="line-clamp-1 text-xs font-semibold text-mx-title">
                      {p.title || '—'}
                    </div>
                    <div className="flex justify-between text-[10px] text-mx-muted">
                      <span>{formatNum(p.views || p.impressions || 0)}</span>
                      <span>{formatNum(p.likes || 0)} ♡</span>
                    </div>
                  </div>
                </a>
              ))}
              {topPosts.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-mx-field p-12 text-center text-sm text-mx-muted">
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
      <div className="relative overflow-hidden rounded-[14px] border border-mx-line bg-white p-5 pl-6 shadow-card">
        <span className="absolute left-0 top-0 h-full w-1 bg-mx-green" aria-hidden />
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
          Latest episode
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-mx-title">
          {latestEpisodeTitle || '—'}
        </div>
        <div className="mt-1 text-[11.5px] text-mx-muted">
          {latestEpisodePublished
            ? format(new Date(latestEpisodePublished), 'MMM d, yyyy')
            : 'no episodes yet'}
        </div>
      </div>
      <Tile
        label="Downloads"
        value={downloads ?? null}
        sub={downloads != null ? 'manual entry' : 'add via "Enter manually"'}
        color="#E1306C"
      />
      <div className="relative overflow-hidden rounded-[14px] border border-mx-line bg-white p-5 pl-6 shadow-card">
        <span className="absolute left-0 top-0 h-full w-1 bg-mx-amber" aria-hidden />
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
          Show launched
        </div>
        <div className="mt-2 text-2xl font-black tracking-tight text-mx-title">
          {showStart ? format(new Date(showStart), 'MMM yyyy') : '—'}
        </div>
        <div className="mt-1 text-[11.5px] text-mx-muted">
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
    <div className="relative overflow-hidden rounded-[14px] border border-mx-line bg-white p-5 pl-6 shadow-card">
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: color }}
        aria-hidden
      />
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-mx-title">
        {value != null ? formatNum(value) : '—'}
      </div>
      <div className="mt-1 text-[11.5px] text-mx-muted">{sub}</div>
    </div>
  );
}
