import { useMemo, useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { isValidEmail } from '@/lib/emails';
import { emailApi } from '@/features/emails/api';
import type { ScheduleSummary } from '@/features/emails/types';
import type { Sender } from '@/features/senders/types';
import type { SenderChoice } from './components/sender-select';

export type ComposeErrors = Partial<Record<'from' | 'to' | 'subject' | 'body' | 'delay' | 'limit' | 'form', string>>;

const FASTEST_DELAY_MS = 1;
const HIGHEST_LIMIT = 100_000;

const FIELD_FOR_ISSUE: Record<string, keyof ComposeErrors> = {
  subject: 'subject',
  body: 'body',
  recipients: 'to',
  senderIds: 'from',
  delayMs: 'delay',
  hourlyLimit: 'limit',
};

type Draft = {
  recipients: string[];
  subject: string;
  body: { html: string; text: string };
  delaySec: string;
  hourlyLimit: string;
};

const validate = (draft: Draft, senderIds: string[], hasSenders: boolean): ComposeErrors => {
  const errors: ComposeErrors = {};
  if (senderIds.length === 0) errors.from = hasSenders ? 'Choose a sender' : 'Add an Ethereal sender first';
  const invalid = draft.recipients.filter((r) => !isValidEmail(r));
  if (draft.recipients.length === 0) errors.to = 'Add at least one recipient, or upload a list';
  else if (invalid.length) errors.to = `Remove ${invalid.length} invalid address${invalid.length === 1 ? '' : 'es'} (in red)`;
  if (!draft.subject.trim()) errors.subject = 'Subject is required';
  if (!draft.body.text) errors.body = 'Write a message';
  if (draft.delaySec && Number(draft.delaySec) < 1) errors.delay = 'At least 1 second';
  if (draft.hourlyLimit && Number(draft.hourlyLimit) < 1) errors.limit = 'At least 1';
  return errors;
};

export function useCompose(senders: Sender[] | undefined) {
  // One key per compose page: a double click or a retry lands on the same campaign.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [chosen, setChosen] = useState<SenderChoice>(null);
  const [draft, setDraft] = useState<Draft>({ recipients: [], subject: '', body: { html: '', text: '' }, delaySec: '', hourlyLimit: '' });
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ComposeErrors>({});
  const [sending, setSending] = useState(false);

  // Until the user picks, the first sender is used, so the common case is zero clicks.
  const firstId = senders?.[0]?.id;
  const from = useMemo<SenderChoice>(() => chosen ?? (firstId ? { mode: 'one', id: firstId } : null), [chosen, firstId]);

  const senderIds = useMemo(() => {
    if (!from || !senders) return [];
    return from.mode === 'all' ? senders.map((s) => s.id) : [from.id];
  }, [from, senders]);

  // Field errors appear after the first submit, then follow the user's edits live.
  const clientErrors = submitted ? validate(draft, senderIds, Boolean(senders?.length)) : {};
  const errors: ComposeErrors = { ...serverErrors, ...clientErrors };

  const edit = <K extends keyof Draft>(field: K) => (value: Draft[K]) => {
    setServerErrors({});
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const set = {
    setFrom: (value: SenderChoice) => {
      setServerErrors({});
      setChosen(value);
    },
    setRecipients: edit('recipients'),
    setSubject: edit('subject'),
    setBody: edit('body'),
    setDelaySec: edit('delaySec'),
    setHourlyLimit: edit('hourlyLimit'),
    setStartAt: (value: Date | null) => {
      setServerErrors({});
      setStartAt(value);
    },
  };

  const dirty = draft.recipients.length > 0 || draft.subject.trim() !== '' || draft.body.text !== '';

  const submit = async (): Promise<ScheduleSummary | null> => {
    setSubmitted(true);
    if (Object.keys(validate(draft, senderIds, Boolean(senders?.length))).length) return null;
    if (startAt && startAt.getTime() <= Date.now()) {
      setServerErrors({ form: 'The scheduled time has passed. Pick another time or clear it to send now.' });
      return null;
    }

    setSending(true);
    try {
      return await emailApi.schedule({
        idempotencyKey,
        subject: draft.subject.trim(),
        body: draft.body.html,
        recipients: draft.recipients,
        senderIds,
        startAt: (startAt ?? new Date()).toISOString(),
        delayMs: draft.delaySec ? Number(draft.delaySec) * 1000 : FASTEST_DELAY_MS,
        hourlyLimit: draft.hourlyLimit ? Number(draft.hourlyLimit) : HIGHEST_LIMIT,
      });
    } catch (err) {
      if (err instanceof ApiRequestError && err.issues.length) {
        // Map server issues ("body.recipients.3") back onto the form fields.
        const mapped: ComposeErrors = {};
        for (const issue of err.issues) {
          const [, field, index] = issue.path.split('.');
          const key = FIELD_FOR_ISSUE[field ?? ''] ?? 'form';
          const detail =
            key === 'to' && index !== undefined ? `${draft.recipients[Number(index)] ?? 'An address'}: ${issue.message}` : issue.message;
          mapped[key] ??= detail;
        }
        setServerErrors(mapped);
      } else {
        setServerErrors({ form: err instanceof Error ? err.message : 'Could not schedule these emails' });
      }
      return null;
    } finally {
      setSending(false);
    }
  };

  return {
    fields: { from, recipients: draft.recipients, subject: draft.subject, delaySec: draft.delaySec, hourlyLimit: draft.hourlyLimit, startAt },
    set,
    errors,
    sending,
    dirty,
    submit,
  };
}
