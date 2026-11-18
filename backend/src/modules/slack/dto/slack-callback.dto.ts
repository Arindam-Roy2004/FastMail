import { z } from "zod";
import { BaseDto } from "../../../common/dto/base.dto.js";

export const slackCallbackSchema = z.object({
  code: z.string().trim().min(1).max(512).optional(),
  state: z.string().trim().min(1).max(2048).optional(),
  error: z.string().trim().max(200).optional(),
});

export type SlackCallbackQuery = z.infer<typeof slackCallbackSchema>;

export class SlackCallbackDto extends BaseDto {
  static schema = slackCallbackSchema;
}
