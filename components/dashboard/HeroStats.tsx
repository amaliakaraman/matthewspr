import { formatNum } from '@/lib/utils';

export interface HeroAccountStat {
  label: string;
  /** Sum of follower counts across that account's platforms — labelled as
   *  "footprint" because audiences overlap heavily and this isn't a unique
   *  audience number. */
  followers: number;
  growth: number;
}

export function HeroStats({ accounts }: { accounts: HeroAccountStat[] }) {
  return (
    <div className="flex gap-3">
      {accounts.map((a) => (
        <div
          key={a.label}
          className="min-w-[140px] rounded-[14px] border border-mx-line bg-white px-5 py-3.5 shadow-card"
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mx-label">
            {a.label}
          </div>
          <div className="mt-1.5 text-[28px] font-black leading-none tracking-tight text-mx-title">
            {formatNum(a.followers)}
          </div>
          <div
            className={
              'mt-1.5 text-[11.5px] font-bold ' +
              (a.growth > 0
                ? 'text-mx-green'
                : a.growth < 0
                ? 'text-mx-red'
                : 'text-mx-muted')
            }
          >
            {a.growth >= 0 ? '+' : ''}
            {formatNum(a.growth)} this period
          </div>
        </div>
      ))}
    </div>
  );
}
