import { Archive, ArrowLeft, ExternalLink, Star, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/features/auth/use-auth';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { formatDetailTime, formatFullTime } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import { useResource } from '@/lib/use-resource';
import { emailApi } from './api';
import { EmailBody } from './components/email-body';
import { EmailStatus } from './components/email-status';
import { SenderDetails } from './components/sender-details';

export function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const email = useResource((signal) => emailApi.get(id, signal), [id], {
    // A scheduled email changes on its own; keep the page honest while it is open.
    pollMs: 5000,
  });
  const data = email.data;
  const backTo = data && (data.status === 'sent' || data.status === 'failed') ? '/sent' : '/scheduled';

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate(backTo));
  useHotkey('Escape', goBack);

  useEffect(() => {
    if (data) document.title = `${data.subject} · ONB`;
  }, [data]);

  return (
    <div className="min-h-full bg-white">
      <header className="flex items-center gap-3 px-4 pb-6 pt-5 md:px-6">
        <IconButton label="Back (Esc)" onClick={goBack} className="text-ink hover:text-ink">
          <ArrowLeft className="size-5" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-normal text-ink">
          {data ? data.subject : email.loading ? <Skeleton className="h-6 w-2/5" /> : null}
        </h1>
        <div className="hidden items-center gap-1 sm:flex">
          <IconButton label="Starring is not available" disabled>
            <Star className="size-5 stroke-[1.5]" />
          </IconButton>
          <IconButton label="Archive is not available" disabled>
            <Archive className="size-5 stroke-[1.5]" />
          </IconButton>
          <IconButton label="Delete is not available" disabled>
            <Trash2 className="size-5 stroke-[1.5]" />
          </IconButton>
          <span className="mx-2 h-8 w-px bg-line-strong" aria-hidden />
        </div>
        <Avatar name={user.name} src={user.avatar} />
      </header>

      {email.loading ? <DetailSkeleton /> : null}

      {!email.loading && !data ? (
        <EmptyState
          icon={<Archive />}
          title={email.error instanceof ApiRequestError && email.error.status === 404 ? "This email doesn't exist or was removed" : "Couldn't load this email"}
          description={email.error instanceof ApiRequestError && email.error.status === 404 ? undefined : errorMessage(email.error)}
          action={
            <Link to="/scheduled" className="font-medium text-brand hover:underline">
              Back to Scheduled
            </Link>
          }
        />
      ) : null}

      {data ? (
        <article className="mx-auto max-w-[1040px] px-4 pb-16 md:px-6">
          <div className="flex items-start gap-4">
            <Avatar name={data.sender.name} className="size-10 text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 text-[15px]">
                  <span className="font-semibold text-ink">{data.sender.name}</span>{' '}
                  <span className="text-muted">&lt;{data.sender.email}&gt;</span>
                </p>
                {data.sentAt ? (
                  <Tooltip content={formatFullTime(data.sentAt)}>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted">{formatDetailTime(data.sentAt)}</span>
                  </Tooltip>
                ) : (
                  <EmailStatus email={data} />
                )}
              </div>
              <SenderDetails email={data} />
              {data.status === 'failed' && data.error ? (
                <p className="mt-2 text-[13px] text-muted">
                  <span className="text-red">Failed</span> after {data.attempts} attempt{data.attempts === 1 ? '' : 's'}: {data.error}
                </p>
              ) : null}

              <div className="mt-6">
                <EmailBody html={data.html} />
              </div>

              {data.previewUrl ? (
                <a
                  href={data.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-fill px-3 py-2 text-[13px] text-ink hover:bg-[#eeefef]"
                >
                  <ExternalLink className="size-3.5 text-muted" aria-hidden />
                  View the delivered message in Ethereal
                </a>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1040px] px-4 md:px-6" aria-label="Loading email">
      <div className="flex gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2.5 pt-6">
            {['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2', 'w-3/5'].map((w) => (
              <Skeleton key={w} className={`h-3 ${w}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
