import { z } from "zod";
import { BaseDto } from "./base.dto.js";

export const idParamSchema = z.strictObject({ id: z.uuid("must be a valid id") });

export type IdParam = z.infer<typeof idParamSchema>;

export class IdParamDto extends BaseDto {
  static schema = idParamSchema;
}
