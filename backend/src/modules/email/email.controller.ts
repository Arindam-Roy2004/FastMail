import type { Request, Response } from "express";
import type { IdParam } from "../../common/dto/id-param.dto.js";
import { validated } from "../../common/middleware/validate.middleware.js";
import ApiResponse from "../../common/utils/api-response.js";
import type { ListEmailsQuery, SearchEmailsQuery } from "./dto/list-emails.dto.js";
import type { ScheduleEmailsInput } from "./dto/schedule-emails.dto.js";
import * as emailService from "./email.service.js";

export const schedule = async (req: Request, res: Response) => {
  const input = validated<ScheduleEmailsInput>(req, "body");
  const summary = await emailService.scheduleEmails(req.user!.id, input);
  if (summary.duplicate) {
    ApiResponse.ok(res, "Already scheduled", summary);
    return;
  }
  ApiResponse.created(res, "Emails scheduled", summary);
};

export const list = async (req: Request, res: Response) => {
  const query = validated<ListEmailsQuery>(req, "query");
  ApiResponse.ok(res, "Emails", await emailService.listEmails(req.user!.id, query));
};

export const counts = async (req: Request, res: Response) => {
  ApiResponse.ok(res, "Counts", await emailService.countEmails(req.user!.id));
};

export const search = async (req: Request, res: Response) => {
  const query = validated<SearchEmailsQuery>(req, "query");
  ApiResponse.ok(res, "Search results", await emailService.searchEmails(req.user!.id, query));
};

export const getOne = async (req: Request, res: Response) => {
  const { id } = validated<IdParam>(req, "params");
  ApiResponse.ok(res, "Email", await emailService.getEmail(req.user!.id, id));
};
