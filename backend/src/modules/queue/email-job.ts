import { z } from "zod";

export const emailJobSchema = z.strictObject({
  emailId: z.uuid(),
  reservedWindow: z.number().int().optional(),
  reservedAt: z.number().int().optional(),
});

export type EmailJobData = z.infer<typeof emailJobSchema>;
