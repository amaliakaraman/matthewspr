import { loadOverview } from '@/lib/dashboard-data';
import { TopBar } from '@/components/layout/TopBar';
import { HeroStats } from '@/components/dashboard/HeroStats';
import { MetricsRow } from '@/components/dashboard/MetricsRow';
import { PlatformCard } from '@/components/dashboard/PlatformCard';
import { AccountSwitcher } from '@/components/dashboard/AccountSwitcher';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PLATFORM_ORDER = ['instagram', 'tiktok', 'linkedin', 'x', 'youtube', 'spotify', 'captivate'] as const;

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { acct?: string };
}) {
  const data = await loadOverview();
  if (!data) redirect('/login');
  const { user, accounts, cards } = data;

  const acct =
    accounts.find((a) => a.id === searchParams.acct) || accounts[0];

  // Hero stats: per account totals
  const heroAccounts = accounts.map((a) => {
    const arr = cards.get(a.id) || [];
    return {
      label: a.label,
      followers: arr.reduce((s, p) => s + (p.latest?.followers || 0), 0),
      growth: arr.reduce((s, p) => s + (p.latest?.growth || 0), 0)
    };
  });

  if (!acct) {
    return (
      <main>
        <TopBar user={user} />
        <div className="px-9 py-16 text-center">
          <h2 className="font-display text-2xl font-bold">No accounts yet.</h2>
          <p className="mt-2 text-ink-dim">
            Visit{' '}
            <a className="text-brand-sky underline" href="/dashboard/settings">
              Settings → Accounts
            </a>{' '}
            to create your first account.
          </p>
        </div>
      </main>
    );
  }

  const platformCards = (cards.get(acct.id) || []).sort(
    (a, b) =>
      PLATFORM_ORDER.indexOf(a.platform as never) -
      PLATFORM_ORDER.indexOf(b.platform as never)
  );
  const footprint = platformCards.reduce(
    (s, p) => s + (p.latest?.followers || 0),
    0
  );
  let largestAudience = 0;
  let largestAudienceLabel = '';
  for (const p of platformCards) {
    const f = p.latest?.followers || 0;
    if (f > largestAudience) {
      largestAudience = f;
      largestAudienceLabel = `${p.platform[0].toUpperCase()}${p.platform.slice(1)}`;
    }
  }
  const growth = platformCards.reduce((s, p) => s + (p.latest?.growth || 0), 0);
  const active = platformCards.filter(
    (p) => p.latest != null || p.status === 'connected'
  ).length;
  const period = platformCards.find((p) => p.latest?.period_label)?.latest
    ?.period_label || 'this period';

  return (
    <main>
      <TopBar user={user} />

      <section className="grid items-end gap-8 px-9 pb-10 pt-8 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="font-display text-5xl font-bold tracking-tight leading-[1.02] lg:text-[58px]">
            <span className="text-gradient">Track every </span>
            <span className="text-rainbow">platform.</span>
            <br />
            <span className="text-gradient">Generate every </span>
            <span className="text-rainbow">recap.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-dim">
            One real-time command center for Kyle Matthews + The Matthews
            Mentality Podcast — across Spotify, Captivate, YouTube, Instagram,
            TikTok, LinkedIn, and X. Snapshots auto-pulled, insights generated
            by Claude, recaps ready to print.
          </p>
        </div>
        <HeroStats accounts={heroAccounts} />
      </section>

      <section className="px-9">
        <AccountSwitcher accounts={accounts} active={acct.id} />

        <MetricsRow
          largestAudience={largestAudience}
          largestAudienceLabel={largestAudienceLabel}
          footprint={footprint}
          growth={growth}
          activePlatforms={active}
          totalPlatforms={7}
          period={period}
          accountLabel={acct.label}
        />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-sky shadow-[0_0_14px_#38BDF8] animate-pulse-dot" />
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {acct.label} — All Platforms
              </h2>
              <div className="mt-0.5 text-xs text-ink-mute">
                Click any card to open its dashboard. Snapshots auto-refresh
                every Monday at 9am.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 xl:grid-cols-3">
          {platformCards.map((p) => (
            <PlatformCard
              key={p.platform}
              accountId={acct.id}
              data={p}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
