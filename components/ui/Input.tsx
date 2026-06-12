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
        'w-full rounded-lg border border-mx-field bg-white px-3.5 py-2.5 text-sm text-mx-title placeholder-mx-muted outline-none transition-shadow hover:border-mx-fieldHover focus:border-mx-blue focus:ring-[3px] focus:ring-[rgba(67,128,243,0.14)]',
        className
      )}
      {...rest}
    />
  );
  if (!label) return field;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-mx-title">
        {label}
      </span>
      {field}
    </label>
  );
});
