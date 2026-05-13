import { formatNum } from '@/lib/utils';

export function MetricsRow({
  largestAudience,
  largestAudienceLabel,
  footprint,
  growth,
  activePlatforms,
  totalPlatforms,
  period,
  accountLabel
}: {
  /** Highest single-platform follower count — the most truthful "biggest audience". */
  largestAudience: number;
  /** Which platform that audience is on. */
  largestAudienceLabel: string;
  /** Sum of follower counts across platforms. Audiences overlap, so this is
   *  framed as a "footprint" rather than a unique audience. */
  footprint: number;
  growth: number;
  activePlatforms: number;
  totalPlatforms: number;
  period: string;
  accountLabel: string;
}) {
  const cards: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: 'Largest audience',
      value: formatNum(largestAudience),
      sub: largestAudienceLabel || `across ${activePlatforms} active platforms`,
      color: '#38BDF8'
    },
    {
      label: `Growth · ${period}`,
      value: `${growth >= 0 ? '+' : ''}${formatNum(growth)}`,
      sub:
        growth >= 0
          ? 'new followers gained'
          : 'net follower change',
      color: '#34D399'
    },
    {
      label: 'Cross-platform footprint',
      value: formatNum(footprint),
      sub: `${accountLabel} · sum of platform audiences (overlap included)`,
      color: '#7C3AED'
    },
    {
      label: 'Active Platforms',
      value: `${activePlatforms} / ${totalPlatforms}`,
      sub: activePlatforms === totalPlatforms ? 'all connected' : 'connect more →',
      color: '#F59E0B'
    }
  ];
  return (
    <div className="mb-8 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-[14px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl"
        >
          <div
            className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full opacity-40 blur-2xl"
            style={{ background: c.color }}
          />
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            {c.label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-gradient">
            {c.value}
          </div>
          <div className="mt-1 text-[11px] text-ink-mute">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
