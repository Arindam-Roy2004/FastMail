import { X } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = { email: string; invalid: boolean; onRemove: () => void };

export function RecipientChip({ email, invalid, onRemove }: Props) {
  return (
    <Tooltip content={invalid ? 'Not a valid email' : undefined}>
      <span
        className={cn(
          'inline-flex h-[22px] max-w-[220px] items-center gap-1 rounded-full border bg-white pl-2.5 pr-1 text-xs',
          invalid ? 'border-red text-red' : 'border-brand text-ink',
        )}
      >
        <span className="truncate">{email}</span>
        <button
          type="button"
          aria-label={`Remove ${email}`}
          onClick={onRemove}
          className="rounded-full p-0.5 text-subtle hover:bg-fill hover:text-ink"
        >
          <X className="size-3" />
        </button>
      </span>
    </Tooltip>
  );
}
