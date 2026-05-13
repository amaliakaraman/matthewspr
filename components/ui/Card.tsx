import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  padded = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[16px] border border-white/[.07] bg-white/[.035] backdrop-blur-xl',
        padded && 'p-5',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
