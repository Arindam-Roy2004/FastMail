import { z } from "zod";
import { BaseDto } from "../../../common/dto/base.dto.js";

export const ETHEREAL_HOST = "smtp.ethereal.email";

const name = z.string().trim().min(1).max(80);

export const createSenderSchema = z.discriminatedUnion("mode", [
  // The server creates a fresh Ethereal inbox through nodemailer.
  z.strictObject({
    mode: z.literal("ethereal"),
    name: name.optional(),
  }),
  z.strictObject({
    mode: z.literal("manual"),
    name,
    email: z.email().trim().toLowerCase().max(254),
    smtpHost: z.literal(ETHEREAL_HOST).default(ETHEREAL_HOST),
    smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
    smtpUser: z.string().trim().min(1).max(254),
    smtpPass: z.string().min(1).max(256),
  }),
]);

export type CreateSenderInput = z.infer<typeof createSenderSchema>;

export class CreateSenderDto extends BaseDto {
  static schema = createSenderSchema;
}
