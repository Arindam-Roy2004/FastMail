import { DelayedError, UnrecoverableError, type Job } from "bullmq";
import { hourWindow, windowEnd } from "../../common/utils/hour-window.js";
import type { Mailer } from "../mail/mailer.js";
import { emailJobSchema, type EmailJobData } from "./email-job.js";
import type { EmailStore } from "./email-store.js";
import type { RateLimiter } from "./rate-limiter.js";

export type RateLimitAlert = {
  userId: string;
  senderId: string;
  senderEmail: string;
  limit: number;
  window: number;
  resumesAt: Date;
};

export type Notifier = {
  rateLimitReached(alert: RateLimitAlert): Promise<void>;
};

export type EmailIndexer = {
  index(emailId: string): Promise<void>;
};

export type ProcessorConfig = {
  gapMs: number;
  maxPerHour: number;
  lockMs: number;
};

export type ProcessorDeps = {
  store: EmailStore;
  mailer: Mailer;
  limiter: RateLimiter;
  notifier: Notifier;
  indexer: EmailIndexer;
  config: ProcessorConfig;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type EmailJob = Pick<Job<EmailJobData>, "id" | "data" | "attemptsMade" | "opts" | "moveToDelayed" | "updateData">;

export type ProcessResult =
  | { outcome: "sent"; messageId: string }
  | { outcome: "skipped"; reason: "already-done" | "missing" };

const IN_PROCESS_WAIT_MS = 5000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const createEmailProcessor = (deps: ProcessorDeps) => {
  const { store, mailer, limiter, notifier, indexer, config } = deps;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;

  const defer = async (job: EmailJob, token: string | undefined, at: number): Promise<never> => {
    await job.moveToDelayed(at, token);
    throw new DelayedError();
  };

  const alertIfFirst = async (alert: RateLimitAlert) => {
    try {
      if (await limiter.claimAlert(alert.senderId, alert.window)) {
        await notifier.rateLimitReached(alert);
      }
    } catch (err) {
      // An alert must never cost an email.
      console.error(`Rate-limit alert for sender ${alert.senderId} failed:`, errorMessage(err));
    }
  };

  return async (job: EmailJob, token?: string): Promise<ProcessResult> => {
    const parsed = emailJobSchema.safeParse(job.data);
    // A malformed payload will never get better on retry.
    if (!parsed.success) throw new UnrecoverableError(`Invalid job payload for job ${job.id}`);
    const data = parsed.data;

    const startedAt = now();
    const claim = await store.claim(data.emailId, new Date(startedAt), new Date(startedAt - config.lockMs));
    if (claim.kind === "done") return { outcome: "skipped", reason: "already-done" };
    if (claim.kind === "missing") return { outcome: "skipped", reason: "missing" };
    // Never complete a job without sending: check again once the other claim expires.
    if (claim.kind === "busy") return defer(job, token, startedAt + config.lockMs);

    const email = claim.email;
    const limit = Math.min(email.hourlyLimit, config.maxPerHour);
    let heldWindow: number | null = null;

    try {
      let sendAt: number;
      const currentWindow = hourWindow(startedAt);
      if (data.reservedWindow === currentWindow && data.reservedAt !== undefined) {
        heldWindow = data.reservedWindow;
        sendAt = Math.max(data.reservedAt, startedAt);
      } else {
        const reservation = await limiter.reserve({
          senderId: email.sender.id,
          now: startedAt,
          limit,
          gapMs: config.gapMs,
        });
        heldWindow = reservation.window;
        sendAt = reservation.sendAt;
        await job.updateData({ ...data, reservedWindow: reservation.window, reservedAt: reservation.sendAt });

        if (reservation.limitHitWindow !== null) {
          await alertIfFirst({
            userId: email.userId,
            senderId: email.sender.id,
            senderEmail: email.sender.email,
            limit,
            window: reservation.limitHitWindow,
            resumesAt: new Date(windowEnd(reservation.limitHitWindow)),
          });
        }
      }

      const wait = sendAt - now();
      if (wait > IN_PROCESS_WAIT_MS) {
        await store.defer(email.id, new Date(sendAt));
        await indexer.index(email.id);
        return await defer(job, token, sendAt);
      }
      if (wait > 0) await sleep(wait);

      const info = await mailer.send({
        emailId: email.id,
        sender: email.sender,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      await store.markSent(email.id, info, new Date(now()));
      await indexer.index(email.id);
      return { outcome: "sent", messageId: info.messageId };
    } catch (err) {
      if (err instanceof DelayedError) throw err;

      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (isLastAttempt) {
        await store.markFailed(email.id, errorMessage(err));
        // The email will never use its slot; give it back to the sender's hour.
        if (heldWindow !== null) await limiter.release(email.sender.id, heldWindow);
        await indexer.index(email.id);
      } else {
        // Let BullMQ's next attempt claim the row again.
        await store.release(email.id);
      }
      throw err;
    }
  };
};
