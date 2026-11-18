import { Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useCounts } from '@/features/emails/use-counts';
import type { useSlack } from '@/features/slack/use-slack';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AccountCard } from './account-card';
import { Logo } from './logo';

type Props = { slack: ReturnType<typeof useSlack>; onNavigate?: () => void };

export function Sidebar({ slack, onNavigate }: Props) {
  const counts = useCounts();

  return (
    <nav aria-label="Mailbox" className="flex h-full flex-col gap-3 px-2 pt-5">
      <Link to="/scheduled" onClick={onNavigate} className="mb-1 w-fit rounded px-3" aria-label="ONB home">
        <Logo />
      </Link>
      <AccountCard slack={slack} />
      <Tooltip content="Compose (C)" side="right">
        <Button asChild variant="outline" className="w-full">
          <Link to="/compose" onClick={onNavigate}>
            Compose
          </Link>
        </Button>
      </Tooltip>

      <div className="mt-5">
        <p className="mb-1 px-4 text-[11px] font-medium uppercase tracking-wide text-subtle">Core</p>
        <ul className="flex flex-col gap-1">
          <NavItem to="/scheduled" icon={<Clock />} label="Scheduled" count={counts.data?.scheduled} onNavigate={onNavigate} />
          <NavItem to="/sent" icon={<Send />} label="Sent" count={counts.data?.sent} onNavigate={onNavigate} />
        </ul>
      </div>
    </nav>
  );
}

type NavItemProps = { to: string; icon: ReactNode; label: string; count?: number; onNavigate?: () => void };

function NavItem({ to, icon, label, count, onNavigate }: NavItemProps) {
  return (
    <li>
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex h-9 items-center gap-3 rounded-lg px-4 text-sm transition-colors [&_svg]:size-4 [&_svg]:stroke-[1.75]',
            isActive ? 'bg-brand-wash font-semibold text-ink' : 'text-ink hover:bg-fill',
          )
        }
      >
        <span className="text-ink-soft">{icon}</span>
        <span className="flex-1">{label}</span>
        {count === undefined ? (
          <Skeleton className="h-2.5 w-5" />
        ) : (
          <span className="text-xs font-normal tabular-nums text-muted">{formatCount(count)}</span>
        )}
      </NavLink>
    </li>
  );
}
