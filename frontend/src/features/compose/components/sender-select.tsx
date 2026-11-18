import { ChevronDown, Plus, Repeat } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import type { Sender } from '@/features/senders/types';
import { cn } from '@/lib/utils';

export type SenderChoice = { mode: 'one'; id: string } | { mode: 'all' } | null;

type Props = {
  id: string;
  senders: Sender[] | undefined;
  value: SenderChoice;
  onChange: (value: SenderChoice) => void;
  onCreate: () => void;
  creating: boolean;
  invalid?: boolean;
};

export function SenderSelect({ id, senders, value, onChange, onCreate, creating, invalid = false }: Props) {
  const selected = value?.mode === 'one' ? senders?.find((s) => s.id === value.id) : undefined;
  const label =
    value?.mode === 'all'
      ? `All senders (${senders?.length ?? 0}, rotating)`
      : (selected?.email ?? (senders && senders.length === 0 ? 'Add a sender' : 'Choose a sender'));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(
            'inline-flex h-[34px] max-w-full items-center gap-2 rounded-md bg-fill px-3 text-sm text-ink hover:bg-[#eeefef]',
            invalid && 'ring-1 ring-red',
          )}
        >
          {senders === undefined ? <Spinner className="size-3.5 text-subtle" /> : null}
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-subtle" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        {senders && senders.length > 0 ? (
          <>
            <DropdownMenuLabel>Senders</DropdownMenuLabel>
            {senders.map((sender) => (
              <DropdownMenuItem key={sender.id} className="h-auto py-1.5" onSelect={() => onChange({ mode: 'one', id: sender.id })}>
                <span className="block truncate">{sender.email}</span>
                <span className="block truncate text-xs text-muted">{sender.name}</span>
              </DropdownMenuItem>
            ))}
            {senders.length > 1 ? (
              <DropdownMenuItem icon={<Repeat />} onSelect={() => onChange({ mode: 'all' })}>
                All senders (rotate)
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          icon={creating ? <Spinner className="size-3.5" /> : <Plus />}
          disabled={creating}
          onSelect={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          Add Ethereal sender
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
