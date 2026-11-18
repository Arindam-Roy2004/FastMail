import { Check } from 'lucide-react';
import { DropdownMenu as Menu } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, align = 'start', ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-44 rounded-lg border border-line bg-white p-1 shadow-popover animate-in fade-in-0 slide-in-from-top-1 duration-150',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

type ItemProps = ComponentProps<typeof Menu.Item> & { icon?: ReactNode; tone?: 'default' | 'danger' };

export function DropdownMenuItem({ className, icon, tone = 'default', children, ...props }: ItemProps) {
  return (
    <Menu.Item
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-fill',
        tone === 'danger' ? 'text-red' : 'text-ink',
        className,
      )}
      {...props}
    >
      {icon ? <span className="flex size-4 items-center justify-center text-muted [&_svg]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Menu.Item>
  );
}

type CheckItemProps = { checked: boolean; onSelect: () => void; children: ReactNode };

export function DropdownMenuCheckItem({ checked, onSelect, children }: CheckItemProps) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm outline-none data-[highlighted]:bg-fill',
        checked ? 'font-medium text-brand' : 'text-ink',
      )}
    >
      <span className="flex-1">{children}</span>
      {checked ? <Check className="size-4" aria-hidden /> : null}
    </Menu.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{children}</Menu.Label>;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}
