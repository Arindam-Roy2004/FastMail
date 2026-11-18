import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('select-none font-pixel text-[32px] font-bold leading-none tracking-[-0.02em] text-ink', className)}>
      ONB
    </span>
  );
}
