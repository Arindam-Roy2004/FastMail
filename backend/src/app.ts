import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { db } from "./common/config/db.js";
import { elastic } from "./common/config/elastic.js";
import { env } from "./common/config/env.js";
import { getRedis } from "./common/config/redis.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import authRoute from "./modules/auth/auth.routes.js";
import { authenticateCookie } from "./modules/auth/auth.middleware.js";
import emailRoute from "./modules/email/email.routes.js";
import { BULL_BOARD_PATH, createBullBoardRouter } from "./modules/queue/bull-board.js";
import senderRoute from "./modules/sender/sender.routes.js";
import slackRoute from "./modules/slack/slack.routes.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
// 2mb rather than the 100kb default: 5000 recipients plus an HTML body.
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Liveness: touches nothing external, so it stays honest during an outage.
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "email-scheduler-api" });
});

app.get("/health/ready", async (_req, res) => {
  const check = async (fn: () => Promise<unknown>) =>
    fn().then(
      () => "up",
      () => "down",
    );
  const [postgres, redis, elasticsearch] = await Promise.all([
    check(() => db.$queryRaw`SELECT 1`),
    check(() => getRedis().ping()),
    check(() => elastic.ping()),
  ]);
  const ok = postgres === "up" && redis === "up";
  res.status(ok ? 200 : 503).json({ ok, checks: { postgres, redis, elasticsearch } });
});

app.use("/api/auth", authRoute);
app.use("/api/senders", senderRoute);
app.use("/api/emails", emailRoute);
app.use("/api/slack", slackRoute);
app.use(BULL_BOARD_PATH, authenticateCookie, createBullBoardRouter());

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

export default app;
