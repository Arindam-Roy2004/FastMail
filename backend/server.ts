import http from "node:http";
import { connectDB, db } from "./src/common/config/db.js";
import { env } from "./src/common/config/env.js";
import { closeRedis } from "./src/common/config/redis.js";
import app from "./src/app.js";
import { ensureEmailIndex } from "./src/modules/email/email.search.js";
import { closeEmailQueue } from "./src/modules/queue/email.queue.js";
import { reconcile } from "./src/modules/queue/reconcile.js";

const start = async () => {
  // Connect before binding the port: fail fast rather than accept traffic we can't serve.
  await connectDB();

  // Search is optional at boot; the API works without it and search answers 503.
  await ensureEmailIndex().catch((err) => console.warn("Elasticsearch unavailable at boot:", err.message));

  // Re-queue anything Redis lost while we were down. The worker runs this too.
  await reconcile({ lockMs: env.JOB_LOCK_MS }).catch((err) => console.error("Reconcile failed:", err));

  const server = http.createServer(app);
  server.listen(env.PORT, () => {
    console.log(`Email scheduler API on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    console.log(`Bull Board on http://localhost:${env.PORT}/admin/queues`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: closing API`);
    server.close();
    await Promise.allSettled([closeEmailQueue(), closeRedis(), db.$disconnect()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

start().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
