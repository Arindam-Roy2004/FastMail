import { Filter, RotateCw, Search, X } from 'lucide-react';
import { useRef } from 'react';
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { useHotkey } from '@/lib/use-hotkey';
import { cn } from '@/lib/utils';
import type { EmailStatus } from '../types';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  filters: EmailStatus[];
  status: EmailStatus | undefined;
  onStatusChange: (status: EmailStatus | undefined) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

const LABELS: Record<EmailStatus, string> = {
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

export function ListToolbar({ query, onQueryChange, filters, status, onStatusChange, refreshing, onRefresh }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkey('/', () => inputRef.current?.focus());

  return (
    <div className="flex items-center gap-3 px-4 pb-2 pt-5 md:pl-4 md:pr-6">
      <label className="relative flex h-[38px] min-w-0 flex-1 items-center rounded-full bg-fill pl-10 pr-3 transition-shadow focus-within:shadow-[0_0_0_2px_rgb(0_166_62/0.25)] md:max-w-[672px]">
        <Search className="pointer-events-none absolute left-4 size-4 text-subtle" aria-hidden />
        <span className="sr-only">Search emails</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onQueryChange('');
              event.currentTarget.blur();
            }
          }}
          placeholder="Search"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button type="button" aria-label="Clear search" className="rounded-full p-1 text-subtle hover:text-muted" onClick={() => onQueryChange('')}>
            <X className="size-3.5" />
          </button>
        ) : null}
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span>
            <IconButton label={status ? `Filter: ${LABELS[status]}` : 'Filter'} active={Boolean(status)}>
              <Filter className="size-[18px] stroke-[1.75]" />
            </IconButton>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuCheckItem checked={!status} onSelect={() => onStatusChange(undefined)}>
            All
          </DropdownMenuCheckItem>
          {filters.map((value) => (
            <DropdownMenuCheckItem key={value} checked={status === value} onSelect={() => onStatusChange(value)}>
              {LABELS[value]}
            </DropdownMenuCheckItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton label="Refresh" onClick={onRefresh}>
        <RotateCw className={cn('size-[18px] stroke-[1.75]', refreshing && 'animate-spin [animation-duration:600ms]')} />
      </IconButton>
    </div>
  );
}
