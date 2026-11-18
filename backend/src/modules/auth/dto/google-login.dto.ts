import { z } from "zod";
import { BaseDto } from "../../../common/dto/base.dto.js";

export const googleLoginSchema = z.strictObject({
  code: z.string().trim().min(10).max(2048),
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export class GoogleLoginDto extends BaseDto {
  static schema = googleLoginSchema;
}
