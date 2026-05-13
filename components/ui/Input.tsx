import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, className, ...rest },
  ref
) {
  const field = (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm text-ink placeholder-white/30 outline-none focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/20',
        className
      )}
      {...rest}
    />
  );
  if (!label) return field;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </span>
      {field}
    </label>
  );
});
