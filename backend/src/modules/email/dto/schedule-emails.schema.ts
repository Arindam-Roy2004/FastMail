import { z } from "zod";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const recipientSchema = z.string().trim().toLowerCase().max(254, "is too long").pipe(z.email("Invalid email"));

export const buildScheduleEmailsSchema = (maxRecipients: number) =>
  z.strictObject({
    idempotencyKey: z.uuid(),
    subject: z
      .string()
      .trim()
      .min(1, "Subject is required")
      .max(200)
      // CR or LF in a subject would let a client inject extra mail headers.
      .refine((s) => !/[\r\n]/.test(s), "Subject must be a single line"),
    body: z.string().min(1, "Body is required").max(200_000, "Body is too large"),
    recipients: z
      .array(recipientSchema)
      .min(1, "Add at least one recipient")
      .max(maxRecipients, `At most ${maxRecipients} recipients per request`)
      .transform((list) => [...new Set(list)]),
    senderIds: z
      .array(z.uuid())
      .min(1, "Pick a sender")
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, "Sender ids must be unique"),
    startAt: z.iso
      .datetime({ offset: true, message: "Must be an ISO date-time with a time zone offset" })
      .transform((s) => new Date(s))
      .refine((d) => d.getTime() <= Date.now() + YEAR_MS, "Start time must be within a year"),
    delayMs: z.number().int().positive().max(24 * 60 * 60 * 1000),
    hourlyLimit: z.number().int().positive().max(100_000),
  });

export type ScheduleEmailsInput = z.infer<ReturnType<typeof buildScheduleEmailsSchema>>;
