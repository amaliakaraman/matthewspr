'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="hidden gap-1 rounded-[14px] border border-white/5 bg-white/[.035] p-1.5 backdrop-blur-xl md:flex">
      {items.map((n) => {
        const active =
          n.href === '/dashboard'
            ? path === '/dashboard'
            : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              'flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition-colors',
              active
                ? 'bg-gradient-to-br from-[#0EA5E9] to-[#7C3AED] text-white shadow-[0_8px_24px_rgba(14,165,233,.35)]'
                : 'text-ink-dim hover:text-ink'
            )}
          >
            <span className="text-xs">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
