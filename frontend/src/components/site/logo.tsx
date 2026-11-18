import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('select-none font-pixel text-[30px] font-bold leading-none tracking-[-0.12em] text-ink', className)}>
      ONB
    </span>
  );
}
