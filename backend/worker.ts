import { Worker } from "bullmq";
import { connectDB, db } from "./src/common/config/db.js";
import { env } from "./src/common/config/env.js";
import { closeRedis, getRedis, redisConnection } from "./src/common/config/redis.js";
import { createSearchIndexer, ensureEmailIndex } from "./src/modules/email/email.search.js";
import { createSmtpMailer } from "./src/modules/mail/mailer.js";
import type { EmailJobData } from "./src/modules/queue/email-job.js";
import { createPrismaEmailStore } from "./src/modules/queue/email-store.js";
import { createEmailProcessor, type ProcessResult } from "./src/modules/queue/email.processor.js";
import { closeEmailQueue, EMAIL_QUEUE_NAME } from "./src/modules/queue/email.queue.js";
import { createRedisRateLimiter } from "./src/modules/queue/rate-limiter.js";
import { reconcile } from "./src/modules/queue/reconcile.js";
import { createSlackNotifier } from "./src/modules/slack/slack.service.js";

await connectDB();
await ensureEmailIndex().catch((err) => console.warn("Elasticsearch unavailable at boot:", err.message));
await reconcile({ lockMs: env.JOB_LOCK_MS }).catch((err) => console.error("Reconcile failed:", err));

const mailer = createSmtpMailer();

// The real implementations of every edge the processor depends on.
const processor = createEmailProcessor({
  store: createPrismaEmailStore(db),
  mailer,
  limiter: createRedisRateLimiter(getRedis()),
  notifier: createSlackNotifier(),
  indexer: createSearchIndexer(),
  config: {
    gapMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
    maxPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    lockMs: env.JOB_LOCK_MS,
  },
});

const worker = new Worker<EmailJobData, ProcessResult>(EMAIL_QUEUE_NAME, processor, {
  connection: redisConnection,
  concurrency: env.WORKER_CONCURRENCY,
  lockDuration: env.JOB_LOCK_MS,
});

worker.on("ready", () => {
  console.log(
    `Worker ready: concurrency ${env.WORKER_CONCURRENCY}, ` +
      `min ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms between sends per sender, ` +
      `max ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/hour per sender`,
  );
});
worker.on("completed", (job, result) => {
  if (result.outcome === "sent") console.log(`Sent email ${job.data.emailId}`);
  else console.log(`Skipped job ${job.id}: ${result.reason}`);
});
worker.on("failed", (job, err) => {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  const final = job.attemptsMade >= attempts;
  console.error(`Email ${job.data.emailId} attempt ${job.attemptsMade}/${attempts} failed${final ? " (final)" : ""}: ${err.message}`);
});
worker.on("error", (err) => console.error("Worker error:", err.message));

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: finishing active sends, then exiting`);
  await Promise.allSettled([worker.close()]);
  mailer.close();
  await Promise.allSettled([closeEmailQueue(), closeRedis(), db.$disconnect()]);
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));
