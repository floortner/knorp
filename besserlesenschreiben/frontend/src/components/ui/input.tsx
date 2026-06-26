import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-14 w-full rounded-2xl bg-white px-5 text-base text-ink shadow-sm ring-1 ring-black/5 placeholder:text-ink-soft/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
