'use client';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Account } from '@/lib/supabase/types';

export function AccountSwitcher({
  accounts,
  active
}: {
  accounts: Account[];
  active: string;
}) {
  const path = usePathname();
  const params = useSearchParams();

  return (
    <div className="mb-6 inline-flex gap-1 rounded-[11px] border border-white/[.07] bg-white/[.035] p-1.5 backdrop-blur-xl">
      {accounts.map((a) => {
        const isActive = a.id === active;
        const next = new URLSearchParams(params);
        next.set('acct', a.id);
        return (
          <Link
            key={a.id}
            href={`${path}?${next.toString()}`}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] transition-colors',
              isActive
                ? 'bg-white/10 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)]'
                : 'text-ink-dim hover:text-ink'
            )}
          >
            <span
              className={cn(
                'rounded px-1.5 py-[2px] text-[9px] font-bold tracking-[0.08em]',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'bg-brand-sky/15 text-brand-sky'
              )}
            >
              {a.tag}
            </span>
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
