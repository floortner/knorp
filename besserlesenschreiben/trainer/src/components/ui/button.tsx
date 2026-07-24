import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-white shadow-sm hover:bg-teal-dark',
        good: 'bg-good text-white shadow-sm hover:brightness-95',
        danger: 'bg-danger text-white shadow-sm hover:brightness-95',
        ghost: 'bg-surface text-ink shadow-sm ring-1 ring-line hover:bg-black/[0.02]',
        link: 'text-teal-dark hover:underline',
      },
      size: {
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        sm: 'h-8 px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
