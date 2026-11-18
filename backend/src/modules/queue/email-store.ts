import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SentInfo, SmtpSender } from "../mail/mailer.js";

export type ClaimedEmail = {
  id: string;
  userId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  hourlyLimit: number;
  sender: SmtpSender;
};

export type ClaimResult =
  | { kind: "claimed"; email: ClaimedEmail }
  // Already sent or failed: a duplicate delivery of the job.
  | { kind: "done" }
  // Another worker holds a fresh claim on it.
  | { kind: "busy" }
  // Row deleted (campaign removed) after the job was queued.
  | { kind: "missing" };

export type EmailStore = {
  claim(emailId: string, now: Date, staleBefore: Date): Promise<ClaimResult>;
  release(emailId: string): Promise<void>;
  defer(emailId: string, sendAt: Date): Promise<void>;
  markSent(emailId: string, info: SentInfo, sentAt: Date): Promise<void>;
  markFailed(emailId: string, error: string): Promise<void>;
};

export const createPrismaEmailStore = (db: PrismaClient): EmailStore => ({
  async claim(emailId, now, staleBefore) {
    const { count } = await db.email.updateMany({
      where: {
        id: emailId,
        OR: [{ status: "scheduled" }, { status: "sending", claimedAt: { lt: staleBefore } }],
      },
      data: { status: "sending", claimedAt: now, attempts: { increment: 1 } },
    });

    if (count === 0) {
      const row = await db.email.findUnique({ where: { id: emailId }, select: { status: true } });
      if (!row) return { kind: "missing" };
      if (row.status === "sent" || row.status === "failed") return { kind: "done" };
      return { kind: "busy" };
    }

    const row = await db.email.findUniqueOrThrow({
      where: { id: emailId },
      select: {
        id: true,
        userId: true,
        to: true,
        subject: true,
        campaign: { select: { body: true, bodyText: true, hourlyLimit: true } },
        sender: {
          select: { id: true, name: true, email: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true },
        },
      },
    });

    return {
      kind: "claimed",
      email: {
        id: row.id,
        userId: row.userId,
        to: row.to,
        subject: row.subject,
        html: row.campaign.body,
        text: row.campaign.bodyText,
        hourlyLimit: row.campaign.hourlyLimit,
        sender: row.sender,
      },
    };
  },

  async release(emailId) {
    await db.email.updateMany({
      where: { id: emailId, status: "sending" },
      data: { status: "scheduled", claimedAt: null },
    });
  },

  async defer(emailId, sendAt) {
    await db.email.updateMany({
      where: { id: emailId, status: "sending" },
      data: { status: "scheduled", claimedAt: null, scheduledAt: sendAt, attempts: { decrement: 1 } },
    });
  },

  async markSent(emailId, info, sentAt) {
    await db.email.update({
      where: { id: emailId },
      data: {
        status: "sent",
        sentAt,
        messageId: info.messageId,
        previewUrl: info.previewUrl,
        error: null,
        claimedAt: null,
      },
    });
  },

  async markFailed(emailId, error) {
    await db.email.update({
      where: { id: emailId },
      data: { status: "failed", error: error.slice(0, 500), claimedAt: null },
    });
  },
});
