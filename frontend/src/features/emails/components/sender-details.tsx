import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatFullTime } from '@/lib/format';
import type { EmailDetail } from '../types';

type Props = { email: EmailDetail };

export function SenderDetails({ email }: Props) {
  const rows: [string, string][] = [
    ['from', `${email.sender.name} <${email.sender.email}>`],
    ['to', email.to],
    ['subject', email.subject],
    [email.sentAt ? 'sent' : 'scheduled', formatFullTime(email.sentAt ?? email.scheduledAt)],
    ['campaign', `${email.campaign.total} recipient${email.campaign.total === 1 ? '' : 's'}, ${email.campaign.delayMs / 1000}s apart, max ${email.campaign.hourlyLimit}/hour`],
  ];
  if (email.messageId) rows.push(['message id', email.messageId]);

  return (
    <Popover>
      <PopoverTrigger className="mt-0.5 inline-flex items-center gap-1 rounded text-[13px] text-muted hover:text-ink">
        to {email.to}
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,440px)] p-3">
        <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-right text-subtle">{label}:</dt>
              <dd className="break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
