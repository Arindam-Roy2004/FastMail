import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { SlackMark } from './slack-mark';
import type { useSlack } from './use-slack';

type Props = { slack: ReturnType<typeof useSlack> };

export function SlackMenuItems({ slack }: Props) {
  const { status, busy } = slack;

  if (!status) {
    return (
      <DropdownMenuItem icon={<SlackMark />} disabled>
        Slack
      </DropdownMenuItem>
    );
  }

  if (!status.available) {
    return (
      <DropdownMenuItem icon={<SlackMark />} disabled>
        Slack is not configured on the server
      </DropdownMenuItem>
    );
  }

  if (!status.connected) {
    return (
      <DropdownMenuItem icon={<SlackMark />} disabled={busy} onSelect={() => void slack.connect()}>
        Connect Slack
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuLabel>Rate-limit alerts</DropdownMenuLabel>
      <div className="flex h-9 items-center gap-2.5 px-2.5 text-sm text-ink">
        <span className="flex size-4 items-center justify-center">
          <SlackMark />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {status.teamName}
          {status.channel ? <span className="text-muted"> · {status.channel}</span> : null}
        </span>
        <span className="size-1.5 rounded-full bg-brand" aria-label="Connected" />
      </div>
      <DropdownMenuItem disabled={busy} onSelect={() => void slack.sendTest()}>
        Send test message
      </DropdownMenuItem>
      <DropdownMenuItem tone="danger" disabled={busy} onSelect={() => void slack.disconnect()}>
        Disconnect Slack
      </DropdownMenuItem>
    </>
  );
}
