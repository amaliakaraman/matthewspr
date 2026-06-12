'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BookMarked,
  Clapperboard,
  BarChart3,
  Settings,
  LogOut,
  Mic,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  {
    href: '/',
    label: 'Today',
    icon: LayoutDashboard,
    match: (p) => p === '/'
  },
  {
    href: '/bookings',
    label: 'Bookings',
    icon: Mic,
    match: (p) => p.startsWith('/bookings')
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: CalendarDays,
    match: (p) => p.startsWith('/schedule')
  },
  {
    href: '/outreach',
    label: 'Outreach',
    icon: Users,
    match: (p) => p.startsWith('/outreach')
  },
  {
    href: '/library',
    label: 'Library',
    icon: BookMarked,
    match: (p) => p.startsWith('/library')
  },
  {
    href: '/content',
    label: 'Content',
    icon: Clapperboard,
    match: (p) => p.startsWith('/content')
  },
  {
    href: '/dashboard',
    label: 'Social Analytics',
    icon: BarChart3,
    match: (p) => p.startsWith('/dashboard') && !p.startsWith('/dashboard/settings')
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    match: (p) => p.startsWith('/dashboard/settings')
  }
];

export function Sidebar({
  user,
  csrf
}: {
  user: { email?: string | null };
  csrf: string;
}) {
  const path = usePathname();
  const email = user.email || 'signed in';
  const initial = (email[0] || '?').toUpperCase();

  return (
    <aside className="flex h-screen w-[248px] shrink-0 flex-col border-r border-navy-border bg-navy px-4 pb-[18px] pt-[22px]">
      {/* Brand lockup */}
      <Link href="/" className="flex items-center gap-3 px-2 pb-1 pt-0.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-[linear-gradient(160deg,#1B2A4A,#0F1B33)]">
          <Mic size={22} strokeWidth={1.75} className="text-[#CFE0FF]" />
        </div>
        <div className="flex flex-col gap-[2px] leading-none">
          <span className="text-[17px] font-bold tracking-[0.01em] text-white">
            Matthews PR
          </span>
          <span className="text-[8.5px] font-bold uppercase leading-[1.3] tracking-[0.11em] text-navy-sub">
            Podcast + Social
            <br />
            Command Center · By Matthews
          </span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="mt-7 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] tracking-[0.01em] transition-colors',
                active
                  ? 'bg-white/[0.09] font-bold text-white'
                  : 'font-medium text-white/[0.62] hover:bg-white/[0.05] hover:text-white/[0.92]'
              )}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Profile + sign out */}
      <div className="flex flex-col gap-1 border-t border-white/[0.08] pt-3.5">
        <div className="flex items-center gap-[11px] px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#2B2F36] text-[14px] font-bold text-white">
            {initial}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-bold text-white">
              {email}
            </span>
            <span className="text-[11.5px] font-medium text-white/[0.62]">
              Team member
            </span>
          </div>
        </div>
        <form action="/api/auth/signout" method="POST">
          <input type="hidden" name="_csrf" value={csrf} />
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/[0.62] transition-colors hover:bg-white/[0.05] hover:text-white/[0.92]"
          >
            <LogOut size={17} strokeWidth={2} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
