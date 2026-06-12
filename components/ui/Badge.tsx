import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'good' | 'bad' | 'info' | 'warn';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-mx-lineSoft text-mx-secondary',
  good: 'bg-mx-greenBg text-mx-green',
  bad: 'bg-mx-redBg text-mx-red',
  info: 'bg-[rgba(67,128,243,0.12)] text-mx-blueDeep',
  warn: 'bg-mx-amberBg text-mx-amber'
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
