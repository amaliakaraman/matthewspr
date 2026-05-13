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
    <div className="flex gap-3.5">
      {accounts.map((a) => (
        <div
          key={a.label}
          className="min-w-[130px] rounded-xl border border-white/[.07] bg-white/[.035] px-5 py-3.5 backdrop-blur-xl"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            {a.label}
          </div>
          <div className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-gradient">
            {formatNum(a.followers)}
          </div>
          <div
            className={
              'mt-1 text-[11px] font-semibold ' +
              (a.growth > 0
                ? 'text-emerald-400'
                : a.growth < 0
                ? 'text-rose-400'
                : 'text-ink-mute')
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
