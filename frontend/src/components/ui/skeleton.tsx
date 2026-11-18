import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded bg-skeleton', className)} />;
}
