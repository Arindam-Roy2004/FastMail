import { Queue, type JobsOptions } from "bullmq";
import { redisConnection } from "../../common/config/redis.js";
import type { EmailJobData } from "./email-job.js";

export const EMAIL_QUEUE_NAME = "send-email";

const ADD_BULK_CHUNK = 500;

export const emailJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 20_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

const createQueue = () => {
  const created = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: emailJobOptions,
  });
  created.on("error", (err) => console.error("Email queue error:", err.message));
  return created;
};

let queue: ReturnType<typeof createQueue> | null = null;

export const getEmailQueue = () => {
  queue ??= createQueue();
  return queue;
};

export const closeEmailQueue = async () => {
  if (queue) {
    await queue.close();
    queue = null;
  }
};

export type QueueableEmail = { id: string; scheduledAt: Date };

export const enqueueEmails = async (emails: QueueableEmail[], now = Date.now()) => {
  const q = getEmailQueue();
  for (let i = 0; i < emails.length; i += ADD_BULK_CHUNK) {
    const chunk = emails.slice(i, i + ADD_BULK_CHUNK);
    await q.addBulk(
      chunk.map((email) => ({
        name: "send",
        data: { emailId: email.id },
        opts: {
          ...emailJobOptions,
          jobId: email.id,
          delay: Math.max(0, email.scheduledAt.getTime() - now),
        },
      })),
    );
  }
};
