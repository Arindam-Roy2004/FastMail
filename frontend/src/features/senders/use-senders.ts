import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { senderApi } from './api';
import type { Sender } from './types';

export function useSenders() {
  const senders = useResource((signal) => senderApi.list(signal), []);
  const [creating, setCreating] = useState(false);

  const createEthereal = async (): Promise<Sender | null> => {
    setCreating(true);
    try {
      const sender = await senderApi.createEthereal();
      await senders.reload();
      toast.success('Ethereal sender added', { description: sender.email });
      return sender;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create a sender'));
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { senders: senders.data, loading: senders.loading, error: senders.error, creating, createEthereal };
}
