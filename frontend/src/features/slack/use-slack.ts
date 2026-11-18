import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { slackApi } from './api';

export function useSlack() {
  const status = useResource((signal) => slackApi.status(signal), []);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = () =>
    run(async () => {
      const { url } = await slackApi.connectUrl();
      window.location.assign(url);
    });

  const disconnect = () =>
    run(async () => {
      await slackApi.disconnect();
      await status.reload();
      toast.success('Slack disconnected', { description: 'Rate-limit alerts will stop.' });
    });

  const sendTest = () =>
    run(async () => {
      await slackApi.sendTest();
      toast.success('Test message sent to Slack');
    }).then(() => status.reload());

  return { status: status.data, loading: status.loading, busy, connect, disconnect, sendTest, reload: status.reload };
}
