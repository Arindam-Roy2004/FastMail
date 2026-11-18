import type { Request, Response } from "express";
import { validated } from "../../common/middleware/validate.middleware.js";
import ApiResponse from "../../common/utils/api-response.js";
import type { SlackCallbackQuery } from "./dto/slack-callback.dto.js";
import * as slackService from "./slack.service.js";

export const connect = async (req: Request, res: Response) => {
  ApiResponse.ok(res, "Slack authorize URL", { url: slackService.buildConnectUrl(req.user!.id) });
};

export const callback = async (req: Request, res: Response) => {
  const query = validated<SlackCallbackQuery>(req, "query");
  res.redirect(await slackService.completeConnect(query));
};

export const status = async (req: Request, res: Response) => {
  ApiResponse.ok(res, "Slack connection", await slackService.getConnection(req.user!.id));
};

export const disconnect = async (req: Request, res: Response) => {
  await slackService.disconnect(req.user!.id);
  ApiResponse.ok(res, "Slack disconnected");
};

export const test = async (req: Request, res: Response) => {
  await slackService.sendTestMessage(req.user!.id);
  ApiResponse.ok(res, "Test message sent");
};
