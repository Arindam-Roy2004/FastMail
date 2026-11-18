import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

type Props = ComponentProps<'button'> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function IconButton({ label, active = false, className, children, ...props }: Props) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-fill hover:text-muted disabled:opacity-40 disabled:hover:bg-transparent',
          active && 'text-brand hover:text-brand-hover',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}
