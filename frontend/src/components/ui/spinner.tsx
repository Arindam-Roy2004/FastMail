import { cn } from '@/lib/utils';

type Props = { className?: string; label?: string };

export function Spinner({ className, label = 'Loading' }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}
