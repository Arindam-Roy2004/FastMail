import { request } from '@/lib/api';
import type { Session, User } from './types';

export const authApi = {
  loginWithGoogle: (code: string) => request<Session>('/api/auth/google', { method: 'POST', body: { code }, auth: false }),
  me: () => request<User>('/api/auth/me'),
  logout: () => request<null>('/api/auth/logout', { method: 'POST' }),
};
