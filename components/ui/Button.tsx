import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-mx-blue text-white hover:bg-mx-blueDeep shadow-glow',
  ghost: 'text-mx-body hover:bg-mx-hover',
  outline: 'border border-mx-blue bg-white text-mx-blueDeep hover:bg-[rgba(67,128,243,0.08)]',
  danger: 'bg-mx-redBg text-mx-red hover:bg-[#FBDDDD]'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'rounded-md px-3 py-1.5 text-xs font-bold',
  md: 'rounded-lg px-[18px] py-2.5 text-sm font-bold'
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
