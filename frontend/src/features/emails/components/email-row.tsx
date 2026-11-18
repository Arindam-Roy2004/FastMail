import { Star } from 'lucide-react';
import { Link } from 'react-router';
import { Tooltip } from '@/components/ui/tooltip';
import { formatFullTime, formatListTime } from '@/lib/format';
import type { EmailSummary, Tab } from '../types';
import { EmailStatus } from './email-status';

type Props = { email: EmailSummary; tab: Tab };

export function EmailRow({ email, tab }: Props) {
  const sentTime = tab === 'sent' ? (email.sentAt ?? null) : null;

  return (
    <li className="border-b border-line">
      <Link
        to={`/emails/${email.id}`}
        className="group flex h-14 items-center gap-3 px-4 transition-colors duration-150 hover:bg-row-hover md:px-6"
      >
        <span className="w-[120px] shrink-0 truncate text-sm text-ink sm:w-[200px]" title={email.to}>
          To: {email.to}
        </span>
        <EmailStatus email={email} />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-ink">{email.subject}</span>
          {email.preview ? <span className="text-subtle"> - {email.preview}</span> : null}
        </span>
        {sentTime ? (
          <Tooltip content={formatFullTime(sentTime)}>
            <span className="hidden shrink-0 text-[13px] tabular-nums text-subtle sm:inline">{formatListTime(sentTime)}</span>
          </Tooltip>
        ) : null}
        <Star className="size-4 shrink-0 text-faint transition-colors group-hover:text-subtle" aria-hidden />
      </Link>
    </li>
  );
}
