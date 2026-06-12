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
    <div className="mb-6 inline-flex gap-1 rounded-[11px] border border-mx-line bg-mx-lineSoft p-1.5">
      {accounts.map((a) => {
        const isActive = a.id === active;
        const next = new URLSearchParams(params);
        next.set('acct', a.id);
        return (
          <Link
            key={a.id}
            href={`${path}?${next.toString()}`}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-4 py-2 text-[13px] font-bold transition-colors',
              isActive
                ? 'bg-white text-mx-title shadow-card'
                : 'text-mx-secondary hover:text-mx-title'
            )}
          >
            <span
              className={cn(
                'rounded px-1.5 py-[2px] text-[9px] font-bold tracking-[0.08em]',
                isActive
                  ? 'bg-mx-blue text-white'
                  : 'bg-[rgba(67,128,243,0.12)] text-mx-blueDeep'
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
