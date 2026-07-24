import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink shadow-sm ring-1 ring-line placeholder:text-ink-soft/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
