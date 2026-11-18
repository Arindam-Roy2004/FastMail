import { Clock, SearchX, Send, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import type { EmailStatus, Tab } from '../types';
import type { EmailListState } from '../use-emails';
import { EmailRow } from './email-row';

type Props = {
  tab: Tab;
  list: EmailListState;
  query: string;
  status: EmailStatus | undefined;
  onClearQuery: () => void;
  onClearStatus: () => void;
};

export function EmailList({ tab, list, query, status, onClearQuery, onClearStatus }: Props) {
  if (list.loading) return <ListSkeleton />;

  if (list.error && !list.items) {
    return (
      <EmptyState
        icon={<TriangleAlert />}
        title="Couldn't load emails"
        description={errorMessage(list.error)}
        action={<TextAction onClick={() => void list.reload()}>Retry</TextAction>}
      />
    );
  }

  const items = list.items ?? [];
  if (items.length === 0) return <Empty tab={tab} query={query} status={status} onClearQuery={onClearQuery} onClearStatus={onClearStatus} />;

  return (
    <>
      {list.searching ? (
        <p className="px-4 pb-1 pt-2 text-xs text-subtle md:px-6">
          {items.length === 1 ? '1 result' : `${items.length} results`}
        </p>
      ) : null}
      <ul className="border-t border-line md:ml-4 md:mr-4">
        {items.map((email) => (
          <EmailRow key={email.id} email={email} tab={tab} />
        ))}
      </ul>
      {list.canLoadMore ? (
        <div className="flex justify-center py-4">
          <Button variant="ghost" size="sm" onClick={list.loadMore}>
            Load more ({items.length} of {list.total})
          </Button>
        </div>
      ) : null}
    </>
  );
}

function ListSkeleton() {
  const widths = ['w-[46%]', 'w-[58%]', 'w-[40%]', 'w-[52%]', 'w-[44%]', 'w-[60%]', 'w-[48%]', 'w-[55%]'];
  return (
    <ul className="border-t border-line md:ml-4 md:mr-4" aria-label="Loading emails">
      {widths.map((width, i) => (
        <li key={i} className="flex h-14 items-center gap-3 border-b border-line px-4 md:px-6">
          <Skeleton className="h-3 w-[110px] shrink-0" />
          <Skeleton className="ml-0 h-[22px] w-24 shrink-0 rounded-full sm:ml-[90px]" />
          <Skeleton className={`h-3 ${width}`} />
        </li>
      ))}
    </ul>
  );
}

type EmptyProps = Omit<Props, 'list'>;

function Empty({ tab, query, status, onClearQuery, onClearStatus }: EmptyProps) {
  if (query.trim()) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={`No results for "${query.trim()}"`}
        description="Search looks at recipients, subjects, senders and the email body."
        action={<TextAction onClick={onClearQuery}>Clear search</TextAction>}
      />
    );
  }
  if (status) {
    return (
      <EmptyState
        icon={tab === 'scheduled' ? <Clock /> : <Send />}
        title={`No ${status} emails`}
        action={<TextAction onClick={onClearStatus}>Show all</TextAction>}
      />
    );
  }
  if (tab === 'scheduled') {
    return (
      <EmptyState
        icon={<Clock />}
        title="No scheduled emails"
        description="Emails you schedule will show up here."
        action={
          <Link to="/compose" className="font-medium text-brand hover:text-brand-hover hover:underline">
            Compose an email
          </Link>
        }
      />
    );
  }
  return <EmptyState icon={<Send />} title="Nothing sent yet" description="Sent and failed emails will show up here." />;
}

function TextAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-medium text-brand hover:text-brand-hover hover:underline">
      {children}
    </button>
  );
}
