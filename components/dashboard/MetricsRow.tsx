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
  const cards: Array<{ label: string; value: string; sub: string; accent: string }> = [
    {
      label: 'Largest audience',
      value: formatNum(largestAudience),
      sub: largestAudienceLabel || `across ${activePlatforms} active platforms`,
      accent: 'bg-mx-blue'
    },
    {
      label: `Growth · ${period}`,
      value: `${growth >= 0 ? '+' : ''}${formatNum(growth)}`,
      sub: growth >= 0 ? 'new followers gained' : 'net follower change',
      accent: 'bg-mx-green'
    },
    {
      label: 'Cross-platform footprint',
      value: formatNum(footprint),
      sub: `${accountLabel} · sum of platform audiences (overlap included)`,
      accent: 'bg-[#6563EE]'
    },
    {
      label: 'Active platforms',
      value: `${activePlatforms} / ${totalPlatforms}`,
      sub: activePlatforms === totalPlatforms ? 'all connected' : 'connect more',
      accent: 'bg-mx-amber'
    }
  ];
  return (
    <div className="mb-8 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-[14px] border border-mx-line bg-white p-5 pl-6 shadow-card"
        >
          <span
            className={`absolute left-0 top-0 h-full w-1 ${c.accent}`}
            aria-hidden
          />
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
            {c.label}
          </div>
          <div className="mt-2 text-[30px] font-black leading-none tracking-tight text-mx-title">
            {c.value}
          </div>
          <div className="mt-1.5 text-[11.5px] text-mx-secondary">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
