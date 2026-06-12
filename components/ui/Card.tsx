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
        'rounded-[16px] border border-mx-line bg-white shadow-card',
        padded && 'p-5',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
