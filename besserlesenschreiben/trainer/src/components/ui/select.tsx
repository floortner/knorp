import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg bg-surface px-4 text-base text-ink shadow-sm ring-1 ring-line',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
