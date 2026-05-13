import Link from 'next/link';
import { signState } from '@/lib/crypto';
import { NavLinks } from './NavLinks';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '◇' },
  { href: '/dashboard/insights', label: 'Insights', icon: '⟁' },
  { href: '/dashboard/recap', label: 'Recap Studio', icon: '⊟' },
  { href: '/dashboard/snapshots/new', label: 'Manual entry', icon: '✎' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' }
];

/**
 * The sign-out form carries a CSRF token computed as `signState(user.id)`:
 * an HMAC over the user's UUID signed with `TOKEN_ENCRYPTION_KEY`. The route
 * recomputes the HMAC and timing-safe-compares. No cookie needed — Server
 * Components can't reliably set cookies in Next 14, so the earlier
 * cookie-based scheme was a no-op.
 */
export function TopBar({ user }: { user: { id: string; email?: string | null } }) {
  const csrf = signState(user.id);

  return (
    <header className="flex items-center justify-between px-9 py-6">
      <div className="flex items-center gap-12">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-[13px] bg-[conic-gradient(from_130deg,#38BDF8,#7C3AED,#E1306C,#F59E0B,#38BDF8)] shadow-glow">
            <div className="absolute inset-[3px] flex items-center justify-center rounded-[10px] bg-surface-0">
              <span className="text-lg">⚡</span>
            </div>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-bold tracking-tight">
              KM Socials
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Command Center
            </div>
          </div>
        </Link>
        <NavLinks items={NAV} />
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-ink-mute md:inline">
          {user.email}
        </span>
        <form action="/api/auth/signout" method="POST">
          <input type="hidden" name="_csrf" value={csrf} />
          <button className="rounded-[10px] border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-ink-dim hover:bg-white/10">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
