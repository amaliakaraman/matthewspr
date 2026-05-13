import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-prim text-white',
  ghost: 'border border-white/10 bg-white/[.04] text-ink-dim hover:bg-white/10',
  outline: 'border border-white/15 bg-transparent text-ink hover:bg-white/[.04]',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'rounded-md px-3 py-1.5 text-xs font-semibold',
  md: 'rounded-xl px-4 py-2.5 text-sm font-semibold'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        'transition-all disabled:opacity-60',
        className
      )}
      {...rest}
    />
  );
});
