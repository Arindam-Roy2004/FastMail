import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string;
  underlined?: boolean;
  className?: string;
};

export function FormRow({ label, htmlFor, children, error, underlined = false, className }: Props) {
  return (
    <div className={cn('grid grid-cols-[56px_1fr] items-start gap-x-3', className)}>
      <label htmlFor={htmlFor} className="pt-[9px] text-sm text-ink">
        {label}
      </label>
      <div className="min-w-0">
        <div className={cn(underlined && 'border-b border-line-strong focus-within:border-brand/60 transition-colors')}>{children}</div>
        {error ? (
          <p className="mt-1 text-xs text-red" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
