import { z } from "zod";
import { BaseDto } from "../../../common/dto/base.dto.js";

export const TAB_STATUSES = {
  scheduled: ["scheduled", "sending"],
  sent: ["sent", "failed"],
} as const;

export type Tab = keyof typeof TAB_STATUSES;

const tab = z.enum(["scheduled", "sent"]);
const status = z.enum(["scheduled", "sending", "sent", "failed"]);

const statusBelongsToTab = (value: { tab?: Tab; status?: string }) =>
  !value.status || !value.tab || (TAB_STATUSES[value.tab] as readonly string[]).includes(value.status);

export const listEmailsSchema = z
  .strictObject({
    tab,
    status: status.optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(50),
  })
  .refine(statusBelongsToTab, { message: "Status does not belong to this tab", path: ["status"] });

export const searchEmailsSchema = z
  .strictObject({
    q: z.string().trim().min(1, "Type something to search").max(200),
    tab: tab.optional(),
    status: status.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(statusBelongsToTab, { message: "Status does not belong to this tab", path: ["status"] });

export type ListEmailsQuery = z.infer<typeof listEmailsSchema>;
export type SearchEmailsQuery = z.infer<typeof searchEmailsSchema>;

export class ListEmailsDto extends BaseDto {
  static schema = listEmailsSchema;
}

export class SearchEmailsDto extends BaseDto {
  static schema = searchEmailsSchema;
}
