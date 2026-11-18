import { request } from '@/lib/api';
import type { SlackStatus } from './types';

export const slackApi = {
  status: (signal?: AbortSignal) => request<SlackStatus>('/api/slack', { signal }),
  connectUrl: () => request<{ url: string }>('/api/slack/connect', { method: 'POST' }),
  disconnect: () => request<null>('/api/slack', { method: 'DELETE' }),
  sendTest: () => request<null>('/api/slack/test', { method: 'POST' }),
};
