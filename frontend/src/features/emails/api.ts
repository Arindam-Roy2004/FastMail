import { request } from '@/lib/api';
import type {
  EmailCounts,
  EmailDetail,
  EmailPage,
  EmailStatus,
  ScheduleRequest,
  ScheduleSummary,
  SearchResult,
  Tab,
} from './types';

export const emailApi = {
  list: (params: { tab: Tab; status?: EmailStatus; page?: number; limit?: number }, signal?: AbortSignal) =>
    request<EmailPage>('/api/emails', { query: params, signal }),
  search: (params: { q: string; tab: Tab; status?: EmailStatus }, signal?: AbortSignal) =>
    request<SearchResult>('/api/emails/search', { query: params, signal }),
  counts: (signal?: AbortSignal) => request<EmailCounts>('/api/emails/counts', { signal }),
  get: (id: string, signal?: AbortSignal) => request<EmailDetail>(`/api/emails/${id}`, { signal }),
  schedule: (body: ScheduleRequest) => request<ScheduleSummary>('/api/emails/schedule', { method: 'POST', body }),
};
