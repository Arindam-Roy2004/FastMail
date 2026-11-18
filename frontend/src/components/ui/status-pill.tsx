import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'scheduled' | 'sending' | 'sent' | 'failed';

const TONES: Record<PillTone, string> = {
  scheduled: 'border-orange-border bg-orange-bg text-orange',
  sending: 'border-brand-border bg-brand-wash text-brand',
  sent: 'border-line-strong bg-fill text-muted',
  failed: 'border-red-border bg-red-bg text-red',
};

type Props = {
  tone: PillTone;
  children: ReactNode;
  withClock?: boolean;
  className?: string;
};

export function StatusPill({ tone, children, withClock = false, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border px-2 text-xs leading-none tabular-nums',
        TONES[tone],
        className,
      )}
    >
      {withClock ? <Clock className="size-3" strokeWidth={2} aria-hidden /> : null}
      {children}
    </span>
  );
}
