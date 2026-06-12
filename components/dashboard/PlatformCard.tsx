'use client';

import Link from 'next/link';
import { PlatformIcon } from './PlatformIcon';
import { PLATFORM_META } from '@/lib/platforms';
import { cn, formatNum } from '@/lib/utils';
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
  const followers = data.latest?.followers;
  const growth = data.latest?.growth;
  const m = data.latest;

  return (
    <Link
      href={`/dashboard/platform/${accountId}/${data.platform}`}
      className="group relative overflow-hidden rounded-[16px] border border-mx-line bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-cardHover"
    >
      {/* Platform color accent bar */}
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: meta.color }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-glow"
            style={{ background: isInsta ? meta.gradient : meta.color }}
          >
            <PlatformIcon kind={data.platform} className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-mx-title">{meta.name}</div>
            <div className="mt-0.5 text-[12.5px] text-mx-secondary">
              {data.handle || '—'}
            </div>
          </div>
        </div>
        {data.status === 'connected' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mx-greenBg px-2 py-0.5 text-[10px] font-bold text-mx-green">
            <span className="h-1.5 w-1.5 rounded-full bg-mx-dotGreen" /> LIVE
          </span>
        ) : data.status === 'expired' || data.status === 'error' ? (
          <span className="rounded-full bg-mx-redBg px-2 py-0.5 text-[10px] font-bold text-mx-red">
            ATTN
          </span>
        ) : (
          <span className="rounded-full bg-mx-lineSoft px-2 py-0.5 text-[10px] font-bold text-mx-secondary">
            MANUAL
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <div className="text-[40px] font-black leading-none tracking-tight text-mx-title">
          {followers ? formatNum(followers) : '—'}
        </div>
        <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
          {meta.fLabel}
        </div>
        {growth != null && (
          <div
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold',
              growth > 0
                ? 'bg-mx-greenBg text-mx-green'
                : growth < 0
                ? 'bg-mx-redBg text-mx-red'
                : 'bg-mx-lineSoft text-mx-secondary'
            )}
          >
            {growth > 0 ? '▲' : growth < 0 ? '▼' : '•'} {growth > 0 ? '+' : ''}
            {formatNum(growth)} this period
          </div>
        )}
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2.5 border-t border-mx-line pt-4">
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
              className="relative aspect-[9/16] flex-1 overflow-hidden rounded-md border border-mx-line bg-mx-lineSoft"
            >
              {p.thumb_blob_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.thumb_blob_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-mx-muted">
                  ◇
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5 text-[9px] font-bold text-white">
                {formatNum(p.views || p.impressions || p.likes)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-4 flex items-center justify-between text-[11.5px] font-bold">
        <span className="text-mx-link">Open platform →</span>
        {data.profileUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(data.profileUrl!, '_blank', 'noopener,noreferrer');
            }}
            aria-label={`Open ${data.handle || data.platform} in a new tab`}
            className="text-mx-muted hover:text-mx-title"
          >
            ↗
          </button>
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
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-mx-label">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-bold text-mx-title">
        {value != null && value !== '' ? formatNum(value) : '—'}
      </div>
    </div>
  );
}
