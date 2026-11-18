import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useCurrentUser } from '@/features/auth/use-auth';
import { SlackMenuItems } from '@/features/slack/slack-menu-items';
import type { useSlack } from '@/features/slack/use-slack';

type Props = { slack: ReturnType<typeof useSlack> };

export function AccountCard({ slack }: Props) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2.5 rounded-xl bg-fill px-3 py-3 text-left transition-colors hover:bg-[#eeefef] data-[state=open]:bg-[#eeefef]"
        >
          <Avatar name={user.name} src={user.avatar} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">{user.name}</span>
            <span className="block truncate text-[11px] text-muted">{user.email}</span>
          </span>
          <ChevronDown className="size-4 text-subtle transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        <SlackMenuItems slack={slack} />
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LayoutDashboard />} onSelect={() => window.open('/admin/queues', '_blank', 'noopener')}>
          Queue dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<LogOut />}
          onSelect={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
