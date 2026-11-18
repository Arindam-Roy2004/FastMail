import { CalendarDays, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { formatFullTime, timeZoneLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  value: Date | null;
  onChange: (value: Date | null) => void;
};

const tomorrowAt = (now: number, hours: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(hours, 0, 0, 0);
  return date;
};

const PRESETS = [
  { label: 'Tomorrow', hours: 9 },
  { label: 'Tomorrow, 10:00 AM', hours: 10 },
  { label: 'Tomorrow, 11:00 AM', hours: 11 },
  { label: 'Tomorrow, 3:00 PM', hours: 15 },
];

const pad = (n: number) => String(n).padStart(2, '0');

const toInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const sameMinute = (a: Date | null, b: Date) => Boolean(a) && Math.abs(a!.getTime() - b.getTime()) < 60_000;

export function SendLaterPopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(value);
  // "Now" is read when the popover opens (an event), not during render.
  const [now, setNow] = useState(() => Date.now());
  const isPast = pending !== null && pending.getTime() <= now;

  const onOpenChange = (next: boolean) => {
    if (next) {
      setPending(value);
      setNow(Date.now());
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip content={value ? `Sends ${formatFullTime(value.toISOString())}` : 'Send later'}>
        <PopoverTrigger
          aria-label="Send later"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-fill',
            value ? 'text-brand' : 'text-subtle hover:text-muted',
          )}
        >
          <Clock className="size-5 stroke-[1.75]" />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-[320px] p-4" align="end">
        <p className="text-[15px] font-medium text-ink">Send Later</p>

        <label className="mt-4 flex items-center gap-2 border-b border-line-strong pb-1.5 focus-within:border-brand/60">
          <span className="sr-only">Pick date and time</span>
          <input
            type="datetime-local"
            min={toInputValue(new Date(now))}
            value={pending ? toInputValue(pending) : ''}
            onChange={(event) => {
              setNow(Date.now());
              setPending(event.target.value ? new Date(event.target.value) : null);
            }}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-calendar-picker-indicator]:opacity-0',
              pending ? 'text-ink' : 'text-subtle',
            )}
            aria-describedby="send-later-zone"
          />
          <CalendarDays className="pointer-events-none size-4 text-subtle" aria-hidden />
        </label>
        <p id="send-later-zone" className={cn('mt-1.5 text-xs', isPast ? 'text-red' : 'text-subtle')}>
          {isPast ? 'Pick a time in the future' : `Times are in ${timeZoneLabel()}`}
        </p>

        <ul className="mt-3 flex flex-col">
          {PRESETS.map((preset) => {
            const at = tomorrowAt(now, preset.hours);
            const selected = sameMinute(pending, at);
            return (
              <li key={preset.label}>
                <button
                  type="button"
                  onClick={() => setPending(at)}
                  className={cn(
                    'flex h-[35px] w-full items-center justify-between rounded-md px-1 text-left text-sm transition-colors hover:bg-fill',
                    selected ? 'font-medium text-brand' : 'text-ink-soft',
                  )}
                >
                  {preset.label}
                  {selected ? <Check className="size-4" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center gap-2">
          {value ? (
            <button
              type="button"
              className="mr-auto text-xs text-muted hover:text-ink hover:underline"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </button>
          ) : null}
          <Button variant="ghost" size="md" className="ml-auto px-4 font-normal" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="md"
            disabled={!pending || isPast}
            onClick={() => {
              onChange(pending);
              setOpen(false);
            }}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
