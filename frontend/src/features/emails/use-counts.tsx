import { createContext, useContext, type ReactNode } from 'react';
import { useResource, type Resource } from '@/lib/use-resource';
import { emailApi } from './api';
import type { EmailCounts } from './types';

const CountsContext = createContext<Resource<EmailCounts> | null>(null);

export function CountsProvider({ children }: { children: ReactNode }) {
  const counts = useResource((signal) => emailApi.counts(signal), [], { pollMs: 5000 });
  return <CountsContext.Provider value={counts}>{children}</CountsContext.Provider>;
}

export function useCounts() {
  const context = useContext(CountsContext);
  if (!context) throw new Error('useCounts must be used inside CountsProvider');
  return context;
}
