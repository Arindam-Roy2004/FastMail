import { useEffect, useState } from 'react';
import { useResource } from '@/lib/use-resource';
import { emailApi } from './api';
import type { EmailStatus, EmailSummary, Tab } from './types';

const PAGE = 50;
const MAX = 500;
const POLL_MS = 5000;

type Options = { tab: Tab; status?: EmailStatus; query: string };

export type EmailListState = {
  items: EmailSummary[] | undefined;
  total: number;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  searching: boolean;
  canLoadMore: boolean;
  loadMore: () => void;
  reload: () => Promise<void>;
};

export function useEmails({ tab, status, query }: Options): EmailListState {
  const [limit, setLimit] = useState(PAGE);
  const q = query.trim();
  const searching = q.length > 0;

  useEffect(() => {
    setLimit(PAGE);
  }, [tab, status, q]);

  const resource = useResource(
    async (signal) => {
      if (searching) {
        const result = await emailApi.search({ q, tab, status }, signal);
        return { items: result.items, total: result.total };
      }
      const page = await emailApi.list({ tab, status, limit }, signal);
      return { items: page.items, total: page.total };
    },
    [tab, status, q, limit],
    { pollMs: POLL_MS },
  );

  const items = resource.data?.items;
  const total = resource.data?.total ?? 0;

  return {
    items,
    total,
    loading: resource.loading,
    fetching: resource.fetching,
    error: resource.error,
    searching,
    canLoadMore: !searching && items !== undefined && items.length < total && limit < MAX,
    loadMore: () => setLimit((current) => Math.min(current + PAGE, MAX)),
    reload: resource.reload,
  };
}
