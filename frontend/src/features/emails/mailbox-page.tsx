import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { EmailList } from './components/email-list';
import { ListToolbar } from './components/list-toolbar';
import { TAB_FILTERS, type EmailStatus, type Tab } from './types';
import { useCounts } from './use-counts';
import { useDebounced } from './use-debounced';
import { useEmails } from './use-emails';

type Props = { tab: Tab };

export function MailboxPage({ tab }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EmailStatus | undefined>();
  const debouncedQuery = useDebounced(query);
  const list = useEmails({ tab, status, query: debouncedQuery });
  const counts = useCounts();
  const [manualRefresh, setManualRefresh] = useState(false);

  // Switching tabs starts clean.
  const lastTab = useRef(tab);
  useEffect(() => {
    if (lastTab.current === tab) return;
    lastTab.current = tab;
    setQuery('');
    setStatus(undefined);
  }, [tab]);

  useEffect(() => {
    document.title = `${tab === 'scheduled' ? 'Scheduled' : 'Sent'} · ONB`;
  }, [tab]);

  const refresh = async () => {
    setManualRefresh(true);
    try {
      await Promise.all([list.reload(), counts.reload()]);
      // Only a refresh the user asked for reports failure; background polls stay quiet.
      if (list.error) toast.error(errorMessage(list.error, 'Refresh failed'));
    } finally {
      setManualRefresh(false);
    }
  };

  return (
    <div className="pb-10">
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        filters={TAB_FILTERS[tab]}
        status={status}
        onStatusChange={setStatus}
        refreshing={manualRefresh}
        onRefresh={() => void refresh()}
      />
      <EmailList
        tab={tab}
        list={list}
        query={debouncedQuery}
        status={status}
        onClearQuery={() => setQuery('')}
        onClearStatus={() => setStatus(undefined)}
      />
    </div>
  );
}
