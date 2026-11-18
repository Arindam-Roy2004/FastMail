import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<'input'>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  invalid?: boolean;
};

export function NumberField({ label, value, onChange, suffix, invalid = false, id, className, ...props }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="whitespace-nowrap text-sm text-ink">
        {label}
      </label>
      <span
        className={cn(
          'relative flex h-[38px] w-[72px] items-center rounded-md border bg-white px-2.5 transition-shadow focus-within:shadow-[0_0_0_2px_rgb(0_166_62/0.25)]',
          invalid ? 'border-red' : 'border-line-strong',
          className,
        )}
      >
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="00"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent text-sm tabular-nums text-ink outline-none placeholder:text-subtle"
          {...props}
        />
        {suffix ? <span className="pointer-events-none text-xs text-subtle">{suffix}</span> : null}
      </span>
    </div>
  );
}
