import { request } from '@/lib/api';
import type { Sender } from './types';

export const senderApi = {
  list: (signal?: AbortSignal) => request<Sender[]>('/api/senders', { signal }),
  createEthereal: (name?: string) =>
    request<Sender>('/api/senders', { method: 'POST', body: name ? { mode: 'ethereal', name } : { mode: 'ethereal' } }),
};
