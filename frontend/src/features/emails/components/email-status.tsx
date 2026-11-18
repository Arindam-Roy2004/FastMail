import { StatusPill } from '@/components/ui/status-pill';
import { Tooltip } from '@/components/ui/tooltip';
import { formatFullTime, formatPillTime } from '@/lib/format';
import type { EmailSummary } from '../types';

type Props = { email: Pick<EmailSummary, 'status' | 'scheduledAt' | 'error'> };

export function EmailStatus({ email }: Props) {
  if (email.status === 'scheduled') {
    return (
      <Tooltip content={formatFullTime(email.scheduledAt)}>
        <span tabIndex={0} className="rounded-full">
          <StatusPill tone="scheduled" withClock>
            {formatPillTime(email.scheduledAt)}
          </StatusPill>
        </span>
      </Tooltip>
    );
  }
  if (email.status === 'sending') return <StatusPill tone="sending">Sending</StatusPill>;
  if (email.status === 'failed') {
    return (
      <Tooltip content={email.error ? `Failed: ${email.error}` : 'Failed after all retries'}>
        <span tabIndex={0} className="rounded-full">
          <StatusPill tone="failed">Failed</StatusPill>
        </span>
      </Tooltip>
    );
  }
  return <StatusPill tone="sent">Sent</StatusPill>;
}
