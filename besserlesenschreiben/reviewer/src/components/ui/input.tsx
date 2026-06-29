import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg bg-surface px-4 text-base text-ink shadow-sm ring-1 ring-line placeholder:text-ink-soft/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
