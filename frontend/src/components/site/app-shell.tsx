import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { CountsProvider } from '@/features/emails/use-counts';
import { useSlack } from '@/features/slack/use-slack';
import { useHotkey } from '@/lib/use-hotkey';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Sidebar } from './sidebar';

const SLACK_RESULTS: Record<string, () => void> = {
  connected: () => toast.success('Slack connected', { description: 'Rate-limit alerts will arrive in your channel.' }),
  denied: () => toast.info('Slack was not connected', { description: 'You cancelled on Slack.' }),
  error: () => toast.error('Could not connect Slack', { description: 'Try again from the account menu.' }),
};

export function AppShell() {
  const slack = useSlack();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useHotkey('c', () => navigate('/compose'));

  // Slack's OAuth callback lands on /scheduled?slack=connected|denied|error.
  const slackResult = params.get('slack');
  useEffect(() => {
    if (!slackResult) return;
    SLACK_RESULTS[slackResult]?.();
    void slack.reload();
    setParams(
      (prev) => {
        prev.delete('slack');
        return prev;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slackResult]);

  return (
    <CountsProvider>
      <div className="flex h-full">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-[260px] shrink-0 bg-white transition-transform md:static md:translate-x-0',
            drawerOpen ? 'translate-x-0 shadow-popover' : '-translate-x-full',
          )}
        >
          <Sidebar slack={slack} onNavigate={() => setDrawerOpen(false)} />
        </aside>
        {drawerOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-ink/10 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-line px-4 md:hidden">
            <button
              type="button"
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg p-1.5 text-muted hover:bg-fill"
              onClick={() => setDrawerOpen((open) => !open)}
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Logo className="text-2xl" />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </CountsProvider>
  );
}
