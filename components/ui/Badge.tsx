import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'good' | 'bad' | 'info' | 'warn';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-white/10 text-ink-mute',
  good: 'bg-emerald-500/10 text-emerald-300',
  bad: 'bg-rose-500/10 text-rose-300',
  info: 'bg-brand-sky/15 text-brand-sky',
  warn: 'bg-amber-500/15 text-amber-300'
};

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
