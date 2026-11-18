import { BaseDto } from "../../../common/dto/base.dto.js";
import { env } from "../../../common/config/env.js";
import { buildScheduleEmailsSchema } from "./schedule-emails.schema.js";

export type { ScheduleEmailsInput } from "./schedule-emails.schema.js";

export class ScheduleEmailsDto extends BaseDto {
  static schema = buildScheduleEmailsSchema(env.MAX_RECIPIENTS_PER_REQUEST);
}
