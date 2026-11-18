import type { Request, Response } from "express";
import type { IdParam } from "../../common/dto/id-param.dto.js";
import { validated } from "../../common/middleware/validate.middleware.js";
import ApiResponse from "../../common/utils/api-response.js";
import type { CreateSenderInput } from "./dto/create-sender.dto.js";
import * as senderService from "./sender.service.js";

export const list = async (req: Request, res: Response) => {
  const senders = await senderService.listSenders(req.user!.id);
  ApiResponse.ok(res, "Senders", senders);
};

export const create = async (req: Request, res: Response) => {
  const input = validated<CreateSenderInput>(req, "body");
  const sender = await senderService.createSender(req.user!.id, input);
  ApiResponse.created(res, "Sender created", sender);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = validated<IdParam>(req, "params");
  await senderService.deleteSender(req.user!.id, id);
  ApiResponse.ok(res, "Sender deleted");
};
