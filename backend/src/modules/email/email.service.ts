import { randomUUID } from "node:crypto";
import { db } from "../../common/config/db.js";
import { env } from "../../common/config/env.js";
import ApiError from "../../common/utils/api-error.js";
import { Prisma, type EmailStatus } from "../../generated/prisma/client.js";
import { enqueueEmails } from "../queue/email.queue.js";
import { planSchedule } from "../queue/slot-planner.js";
import { assertOwnedSenders } from "../sender/sender.service.js";
import type { ListEmailsQuery, SearchEmailsQuery, Tab } from "./dto/list-emails.dto.js";
import { TAB_STATUSES } from "./dto/list-emails.dto.js";
import type { ScheduleEmailsInput } from "./dto/schedule-emails.dto.js";
import { htmlToText, previewOf, sanitizeEmailHtml } from "./email-html.js";
import { indexCampaign, searchEmailIds } from "./email.search.js";

const LIST_SELECT = {
  id: true,
  to: true,
  subject: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  error: true,
  attempts: true,
  previewUrl: true,
  campaignId: true,
  campaign: { select: { preview: true } },
  sender: { select: { id: true, name: true, email: true } },
} as const;

type ListRow = Prisma.EmailGetPayload<{ select: typeof LIST_SELECT }>;

export const toEmailResponse = (row: ListRow) => ({
  id: row.id,
  to: row.to,
  subject: row.subject,
  preview: row.campaign.preview,
  status: row.status,
  scheduledAt: row.scheduledAt.toISOString(),
  sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  error: row.error,
  attempts: row.attempts,
  previewUrl: row.previewUrl,
  campaignId: row.campaignId,
  sender: row.sender,
});

const summaryOf = async (campaignId: string, duplicate: boolean) => {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { id: true, total: true, delayMs: true, hourlyLimit: true, startAt: true },
  });
  const range = await db.email.aggregate({
    where: { campaignId },
    _min: { scheduledAt: true },
    _max: { scheduledAt: true },
  });
  return {
    campaignId: campaign.id,
    total: campaign.total,
    delayMs: campaign.delayMs,
    hourlyLimit: campaign.hourlyLimit,
    firstSendAt: range._min.scheduledAt?.toISOString() ?? null,
    lastSendAt: range._max.scheduledAt?.toISOString() ?? null,
    duplicate,
  };
};

const enqueueCampaign = async (campaignId: string) => {
  const rows = await db.email.findMany({
    where: { campaignId, status: "scheduled" },
    select: { id: true, scheduledAt: true },
  });
  try {
    await enqueueEmails(rows);
  } catch (err) {
    console.error(`Enqueue failed for campaign ${campaignId}:`, err);
    throw ApiError.unavailable(
      "Your emails are saved but the queue is unreachable. They will be queued automatically when it is back.",
    );
  }
};

export const scheduleEmails = async (userId: string, input: ScheduleEmailsInput) => {
  const existing = await db.campaign.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existing) {
    await enqueueCampaign(existing.id);
    return summaryOf(existing.id, true);
  }

  await assertOwnedSenders(userId, input.senderIds);

  const html = sanitizeEmailHtml(input.body);
  const text = htmlToText(html);
  if (!text) throw ApiError.badRequest("Validation failed", [{ path: "body.body", message: "Body is empty" }]);

  // The env values are hard bounds: a campaign may be slower or stricter, never faster.
  const delayMs = Math.max(input.delayMs, env.MIN_DELAY_BETWEEN_EMAILS_MS);
  const hourlyLimit = Math.min(input.hourlyLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);
  const startAt = Math.max(input.startAt.getTime(), Date.now());

  const plan = planSchedule({
    startAt,
    delayMs,
    hourlyLimit,
    senderIds: input.senderIds,
    count: input.recipients.length,
  });

  const campaignId = randomUUID();
  const emails = plan.map((slot) => ({
    // Ids are made here so the rows and their jobs share them without reading back.
    id: randomUUID(),
    campaignId,
    userId,
    senderId: slot.senderId,
    to: input.recipients[slot.seq]!,
    subject: input.subject,
    seq: slot.seq,
    scheduledAt: new Date(slot.scheduledAt),
  }));

  try {
    await db.$transaction([
      db.campaign.create({
        data: {
          id: campaignId,
          userId,
          idempotencyKey: input.idempotencyKey,
          subject: input.subject,
          body: html,
          bodyText: text,
          preview: previewOf(text),
          startAt: new Date(startAt),
          delayMs,
          hourlyLimit,
          total: emails.length,
        },
      }),
      db.email.createMany({ data: emails }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.campaign.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
        select: { id: true },
      });
      if (winner) return summaryOf(winner.id, true);
    }
    throw err;
  }

  await enqueueEmails(emails).catch(async (err) => {
    console.error(`Enqueue failed for campaign ${campaignId}:`, err);
    throw ApiError.unavailable(
      "Your emails are saved but the queue is unreachable. They will be queued automatically when it is back.",
    );
  });
  await indexCampaign(campaignId);

  return summaryOf(campaignId, false);
};

const orderFor = (tab: Tab): Prisma.EmailOrderByWithRelationInput[] =>
  tab === "scheduled" ? [{ scheduledAt: "asc" }, { seq: "asc" }] : [{ updatedAt: "desc" }];

const statusesFor = (tab: Tab | undefined, status: EmailStatus | undefined): EmailStatus[] => {
  if (status) return [status];
  if (tab) return [...TAB_STATUSES[tab]];
  return ["scheduled", "sending", "sent", "failed"];
};

export const listEmails = async (userId: string, query: ListEmailsQuery) => {
  const where = { userId, status: { in: statusesFor(query.tab, query.status) } };
  const [rows, total] = await Promise.all([
    db.email.findMany({
      where,
      select: LIST_SELECT,
      orderBy: orderFor(query.tab),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.email.count({ where }),
  ]);
  return { items: rows.map(toEmailResponse), page: query.page, limit: query.limit, total };
};

export const countEmails = async (userId: string) => {
  const groups = await db.email.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } });
  const by = Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<EmailStatus, number>>;
  return {
    scheduled: (by.scheduled ?? 0) + (by.sending ?? 0),
    sent: (by.sent ?? 0) + (by.failed ?? 0),
    failed: by.failed ?? 0,
  };
};

export const getEmail = async (userId: string, emailId: string) => {
  // Scoped by userId: another user's valid id is simply "not found".
  const row = await db.email.findFirst({
    where: { id: emailId, userId },
    select: {
      ...LIST_SELECT,
      messageId: true,
      campaign: { select: { preview: true, body: true, delayMs: true, hourlyLimit: true, total: true } },
    },
  });
  if (!row) throw ApiError.notfound("Email not found");
  return {
    ...toEmailResponse(row),
    html: row.campaign.body,
    messageId: row.messageId,
    campaign: {
      id: row.campaignId,
      total: row.campaign.total,
      delayMs: row.campaign.delayMs,
      hourlyLimit: row.campaign.hourlyLimit,
    },
  };
};

export const searchEmails = async (userId: string, query: SearchEmailsQuery) => {
  let ids: string[];
  try {
    ids = await searchEmailIds(userId, query.q, statusesFor(query.tab, query.status), query.limit);
  } catch (err) {
    console.error("Search failed:", err instanceof Error ? err.message : err);
    throw ApiError.unavailable("Search is unavailable right now");
  }
  if (ids.length === 0) return { items: [], total: 0 };

  const rows = await db.email.findMany({ where: { id: { in: ids }, userId }, select: LIST_SELECT });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toEmailResponse(row)] : [];
  });
  return { items, total: items.length };
};
