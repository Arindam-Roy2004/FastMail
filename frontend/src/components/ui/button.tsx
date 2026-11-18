import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        outline: 'rounded-full border border-brand bg-white text-brand hover:bg-brand-tint hover:text-brand-hover',
        // The Google button on the login card.
        wash: 'rounded-lg bg-brand-wash text-ink hover:bg-brand-wash-hover active:bg-[#c9ebd6]',
        ghost: 'rounded-lg text-ink hover:bg-fill',
        link: 'h-auto px-0 text-brand hover:text-brand-hover hover:underline underline-offset-2',
        danger: 'rounded-lg text-red hover:bg-red-bg',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-[34px] px-6 text-sm',
        lg: 'h-12 px-6 text-[15px] font-normal',
        none: '',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

type Props = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: Props) {
  const classes = cn(buttonVariants({ variant, size }), className);
  // Slot needs exactly one child, so a slotted button (a styled Link) gets no spinner.
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner className="size-3.5" /> : null}
      {children}
    </button>
  );
}
