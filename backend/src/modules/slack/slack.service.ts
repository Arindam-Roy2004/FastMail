import { z } from "zod";
import { db } from "../../common/config/db.js";
import { env, slackConfigured } from "../../common/config/env.js";
import ApiError from "../../common/utils/api-error.js";
import { generateSlackState, verifySlackState } from "../../common/utils/jwt.utils.js";
import type { Notifier, RateLimitAlert } from "../queue/email.processor.js";
import type { SlackCallbackQuery } from "./dto/slack-callback.dto.js";

const AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const ACCESS_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_TIMEOUT_MS = 5000;

const oauthAccessSchema = z.object({
  ok: z.literal(true),
  team: z.object({ id: z.string(), name: z.string() }),
  incoming_webhook: z.object({ channel: z.string(), url: z.url() }),
});

const requireSlack = () => {
  if (!slackConfigured) throw ApiError.unavailable("Slack is not configured on the server");
};

export const buildConnectUrl = (userId: string) => {
  requireSlack();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID!);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", env.SLACK_REDIRECT_URI!);
  url.searchParams.set("state", generateSlackState(userId));
  return url.toString();
};

const dashboardUrl = (result: "connected" | "denied" | "error") =>
  `${env.FRONTEND_ORIGIN}/scheduled?slack=${result}`;

export const completeConnect = async (query: SlackCallbackQuery) => {
  if (!slackConfigured) return dashboardUrl("error");
  if (query.error) return dashboardUrl("denied");
  if (!query.code || !query.state) return dashboardUrl("error");

  let userId: string;
  try {
    userId = verifySlackState(query.state);
  } catch {
    return dashboardUrl("error");
  }

  try {
    const response = await fetch(ACCESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID!,
        client_secret: env.SLACK_CLIENT_SECRET!,
        code: query.code,
        redirect_uri: env.SLACK_REDIRECT_URI!,
      }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    const parsed = oauthAccessSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error("Slack oauth.v2.access returned an unexpected body");
      return dashboardUrl("error");
    }
    const { team, incoming_webhook: hook } = parsed.data;
    const data = { teamId: team.id, teamName: team.name, channel: hook.channel, webhookUrl: hook.url };
    await db.slackConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return dashboardUrl("connected");
  } catch (err) {
    console.error("Slack connect failed:", err instanceof Error ? err.message : err);
    return dashboardUrl("error");
  }
};

export const getConnection = async (userId: string) => {
  const connection = await db.slackConnection.findUnique({
    where: { userId },
    select: { teamName: true, channel: true, updatedAt: true },
  });
  return {
    available: slackConfigured,
    connected: Boolean(connection),
    teamName: connection?.teamName ?? null,
    channel: connection?.channel ?? null,
    connectedAt: connection?.updatedAt.toISOString() ?? null,
  };
};

export const disconnect = async (userId: string) => {
  await db.slackConnection.deleteMany({ where: { userId } });
};

type SlackMessage = { text: string; blocks?: unknown[] };

type PostResult = "sent" | "no-connection" | "revoked" | "failed";

const postToUser = async (userId: string, message: SlackMessage): Promise<PostResult> => {
  const connection = await db.slackConnection.findUnique({ where: { userId }, select: { webhookUrl: true } });
  if (!connection) return "no-connection";

  try {
    const response = await fetch(connection.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (response.ok) return "sent";
    const reason = await response.text().catch(() => "");
    if (response.status === 404 || response.status === 410 || reason === "invalid_token") {
      await db.slackConnection.deleteMany({ where: { userId } });
      console.warn(`Slack webhook for user ${userId} is gone (${response.status} ${reason}); connection removed`);
      return "revoked";
    }
    console.error(`Slack webhook answered ${response.status} ${reason}`);
    return "failed";
  } catch (err) {
    console.error("Slack webhook post failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
};

const slackTime = (date: Date) =>
  `<!date^${Math.floor(date.getTime() / 1000)}^{date_short_pretty} at {time}|${date.toISOString()}>`;

export const rateLimitMessage = (alert: RateLimitAlert): SlackMessage => {
  const text = `Hourly limit reached for ${alert.senderEmail}: ${alert.limit} emails this hour. The rest are queued, not dropped.`;
  return {
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Hourly sending limit reached" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${alert.senderEmail}* has sent its *${alert.limit}* emails for this hour.\n` +
            `Remaining emails are queued in order and resume ${slackTime(alert.resumesAt)}. Nothing was dropped.`,
        },
      },
    ],
  };
};

export const sendTestMessage = async (userId: string) => {
  const result = await postToUser(userId, {
    text: "Email scheduler is connected. Rate-limit alerts will arrive in this channel.",
  });
  if (result === "no-connection") throw ApiError.badRequest("Slack is not connected");
  if (result === "revoked") throw ApiError.conflict("The Slack connection was revoked. Connect Slack again.");
  if (result === "failed") throw ApiError.unavailable("Slack did not accept the message. Try again.");
};

export const createSlackNotifier = (): Notifier => ({
  async rateLimitReached(alert) {
    const result = await postToUser(alert.userId, rateLimitMessage(alert));
    if (result === "sent") console.log(`Slack alert sent: ${alert.senderEmail} hit ${alert.limit}/hour`);
  },
});
