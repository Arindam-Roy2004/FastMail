import { ArrowLeft, Paperclip } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { useSenders } from '@/features/senders/use-senders';
import type { ScheduleSummary } from '@/features/emails/types';
import { formatPillTime } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import { FormRow } from './components/form-row';
import { NumberField } from './components/number-field';
import { RecipientField } from './components/recipient-field';
import { RichTextEditor } from './components/rich-text-editor';
import { SendLaterPopover } from './components/send-later-popover';
import { SenderSelect } from './components/sender-select';
import { useCompose } from './use-compose';

const describe = (summary: ScheduleSummary) => {
  const count = `${summary.total} email${summary.total === 1 ? '' : 's'}`;
  const start = summary.firstSendAt ? `starting ${formatPillTime(summary.firstSendAt)}` : '';
  const pacing = `${summary.delayMs / 1000}s apart, up to ${summary.hourlyLimit}/hour per sender`;
  return { title: `${count} scheduled${start ? `, ${start}` : ''}`, description: pacing };
};

export function ComposePage() {
  const navigate = useNavigate();
  const senders = useSenders();
  const compose = useCompose(senders.senders);
  const { fields, set, errors } = compose;
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    document.title = 'Compose · ONB';
  }, []);

  const leave = () => (compose.dirty ? setConfirmLeave(true) : navigate('/scheduled'));

  const send = async () => {
    if (compose.sending) return;
    const summary = await compose.submit();
    if (!summary) return;
    const { title, description } = describe(summary);
    toast.success(summary.duplicate ? 'Already scheduled' : title, { description, duration: 6000 });
    navigate('/scheduled');
  };

  useHotkey('Escape', leave);
  useHotkey('Enter', () => void send(), { meta: true, allowInInputs: true });

  const addSender = async () => {
    const sender = await senders.createEthereal();
    if (sender) set.setFrom({ mode: 'one', id: sender.id });
  };

  return (
    <div className="min-h-full bg-white">
      <header className="flex items-center gap-2 px-4 pb-6 pt-5 md:px-6">
        <IconButton label="Back (Esc)" onClick={leave} className="text-ink hover:text-ink">
          <ArrowLeft className="size-5" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-xl font-normal text-ink">Compose New Email</h1>
        <IconButton label="Attachments are not supported yet" disabled>
          <Paperclip className="size-5 stroke-[1.75]" />
        </IconButton>
        <SendLaterPopover value={fields.startAt} onChange={set.setStartAt} />
        <Button
          variant="outline"
          size={fields.startAt ? 'sm' : 'md'}
          className="ml-2"
          loading={compose.sending}
          onClick={() => void send()}
          title="Cmd/Ctrl + Enter"
        >
          {fields.startAt ? 'Send Later' : 'Send'}
        </Button>
      </header>

      <form
        className="mx-auto flex max-w-[1040px] flex-col gap-4 px-4 pb-16 md:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        noValidate
      >
        <FormRow label="From" htmlFor="compose-from" error={errors.from}>
          <SenderSelect
            id="compose-from"
            senders={senders.senders}
            value={fields.from}
            onChange={set.setFrom}
            onCreate={() => void addSender()}
            creating={senders.creating}
            invalid={Boolean(errors.from)}
          />
        </FormRow>

        <FormRow label="To" htmlFor="compose-to" underlined error={errors.to}>
          <RecipientField id="compose-to" recipients={fields.recipients} onChange={set.setRecipients} invalid={Boolean(errors.to)} />
        </FormRow>

        <FormRow label="Subject" htmlFor="compose-subject" underlined error={errors.subject}>
          <input
            id="compose-subject"
            value={fields.subject}
            onChange={(event) => set.setSubject(event.target.value.replace(/[\r\n]/g, ''))}
            placeholder="Subject"
            maxLength={200}
            autoComplete="off"
            aria-invalid={Boolean(errors.subject) || undefined}
            className="h-[38px] w-full bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormRow>

        <div className="flex flex-wrap items-start gap-x-7 gap-y-2">
          <div>
            <NumberField
              id="compose-delay"
              label="Delay between 2 emails"
              value={fields.delaySec}
              onChange={set.setDelaySec}
              suffix="sec"
              invalid={Boolean(errors.delay)}
              title="Seconds between two sends. Leave empty for the fastest the server allows."
            />
            {errors.delay ? <p className="mt-1 text-xs text-red">{errors.delay}</p> : null}
          </div>
          <div>
            <NumberField
              id="compose-limit"
              label="Hourly Limit"
              value={fields.hourlyLimit}
              onChange={set.setHourlyLimit}
              invalid={Boolean(errors.limit)}
              title="Most emails per sender per hour. Leave empty for the server maximum."
            />
            {errors.limit ? <p className="mt-1 text-xs text-red">{errors.limit}</p> : null}
          </div>
        </div>

        <div>
          <RichTextEditor onChange={(html, text) => set.setBody({ html, text })} invalid={Boolean(errors.body)} />
          {errors.body ? <p className="mt-1 text-xs text-red">{errors.body}</p> : null}
        </div>

        {errors.form ? (
          <p className="rounded-lg bg-red-bg px-3 py-2 text-[13px] text-red" role="alert">
            {errors.form}
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Discard this email?"
        description="Nothing has been scheduled yet. Your recipients and message will be lost."
        confirmLabel="Discard"
        onConfirm={() => navigate('/scheduled')}
      />
    </div>
  );
}
