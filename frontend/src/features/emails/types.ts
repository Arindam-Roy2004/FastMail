export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';

export type Tab = 'scheduled' | 'sent';

export type EmailSender = { id: string; name: string; email: string };

export type EmailSummary = {
  id: string;
  to: string;
  subject: string;
  preview: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  attempts: number;
  previewUrl: string | null;
  campaignId: string;
  sender: EmailSender;
};

export type EmailDetail = EmailSummary & {
  html: string;
  messageId: string | null;
  campaign: { id: string; total: number; delayMs: number; hourlyLimit: number };
};

export type EmailPage = { items: EmailSummary[]; page: number; limit: number; total: number };

export type SearchResult = { items: EmailSummary[]; total: number };

export type EmailCounts = { scheduled: number; sent: number; failed: number };

export type ScheduleRequest = {
  idempotencyKey: string;
  subject: string;
  body: string;
  recipients: string[];
  senderIds: string[];
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
};

export type ScheduleSummary = {
  campaignId: string;
  total: number;
  delayMs: number;
  hourlyLimit: number;
  firstSendAt: string | null;
  lastSendAt: string | null;
  duplicate: boolean;
};

export const TAB_FILTERS: Record<Tab, EmailStatus[]> = {
  scheduled: ['scheduled', 'sending'],
  sent: ['sent', 'failed'],
};
