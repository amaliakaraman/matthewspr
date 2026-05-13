'use client';

import Link from 'next/link';
import { PlatformIcon } from './PlatformIcon';
import { PLATFORM_META } from '@/lib/platforms';
import { cn, formatNum, trendClass } from '@/lib/utils';
import type { PlatformKind, Snapshot, Post } from '@/lib/supabase/types';

export interface PlatformCardData {
  platform: PlatformKind;
  handle: string | null;
  profileUrl: string | null;
  status: string;
  latest: Snapshot | null;
  prior: Snapshot | null;
  topPosts: Post[];
}

export function PlatformCard({
  accountId,
  data
}: {
  accountId: string;
  data: PlatformCardData;
}) {
  const meta = PLATFORM_META[data.platform];
  const isInsta = data.platform === 'instagram';
  const isDark = data.platform === 'tiktok' || data.platform === 'x';
  const followers = data.latest?.followers;
  const growth = data.latest?.growth;
  const m = data.latest;

  return (
    <Link
      href={`/dashboard/platform/${accountId}/${data.platform}`}
      className="group relative overflow-hidden rounded-[18px] border border-white/[.07] bg-white/[.035] p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/20"
      style={{ '--p-color': meta.color } as React.CSSProperties}
    >
      {/* Glow accent */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: meta.color }}
      />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-[13px] text-white shadow-lg',
              isDark && 'border border-white/20'
            )}
            style={{
              background: isInsta ? meta.gradient : meta.color,
              color: data.platform === 'x' ? '#fff' : '#fff'
            }}
          >
            <PlatformIcon kind={data.platform} className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-[15px] font-bold">
              {meta.name}
            </div>
            <div className="mt-0.5 text-xs text-ink-mute">
              {data.handle || '—'}
            </div>
          </div>
        </div>
        {data.status === 'connected' ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            LIVE
          </span>
        ) : data.status === 'expired' || data.status === 'error' ? (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            ATTN
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-ink-mute">
            MANUAL
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <div className="font-display text-[42px] font-bold leading-none tracking-tight text-gradient">
          {followers ? formatNum(followers) : '—'}
        </div>
        <div className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          {meta.fLabel}
        </div>
        {growth != null && (
          <div
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
              growth > 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : growth < 0
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-white/10 bg-white/[.04] text-ink-mute'
            )}
          >
            {growth > 0 ? '▲' : growth < 0 ? '▼' : '•'} {growth > 0 ? '+' : ''}
            {formatNum(growth)} this period
          </div>
        )}
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2.5 border-t border-white/5 pt-4">
        <Metric label={meta.metrics[0]} value={m?.views ?? m?.plays ?? m?.impressions} />
        <Metric label={meta.metrics[1]} value={m?.likes ?? m?.saves} />
        <Metric
          label={meta.metrics[2]}
          value={m?.profile_visits ?? m?.episodes ?? m?.unique_listeners}
        />
      </div>

      {data.topPosts.length > 0 && (
        <div className="relative mt-4 flex gap-1.5">
          {data.topPosts.slice(0, 4).map((p, i) => (
            <div
              key={i}
              className="relative aspect-[9/16] flex-1 overflow-hidden rounded-md border border-white/5 bg-white/5"
            >
              {p.thumb_blob_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.thumb_blob_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-mute">
                  ◇
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {formatNum(p.views || p.impressions || p.likes)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-4 flex items-center justify-between text-[11px] font-semibold">
        <span style={{ color: meta.color }} className="opacity-80 group-hover:opacity-100">
          Open platform →
        </span>
        {data.profileUrl && (
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-ink-mute hover:text-ink"
          >
            ↗
          </a>
        )}
      </div>
    </Link>
  );
}

function Metric({
  label,
  value
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </div>
      <div className="mt-1 font-display text-[15px] font-semibold">
        {value != null && value !== '' ? formatNum(value) : '—'}
      </div>
    </div>
  );
}
