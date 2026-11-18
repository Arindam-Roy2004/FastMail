import { z } from "zod";
import type { ApiIssue } from "../utils/api-error.js";

export const toIssues = (error: z.ZodError): ApiIssue[] =>
  error.issues.flatMap((issue) => {
    const base = issue.path.map(String);
    // One issue per unknown key, pointing at the key itself, not at its parent.
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ path: [...base, key].join("."), message: "Unknown field" }));
    }
    return [{ path: base.join(".") || "(root)", message: issue.message }];
  });

export abstract class BaseDto {
  static schema: z.ZodType = z.strictObject({});

  static validate(data: unknown): { errors: ApiIssue[] | null; value: unknown } {
    const result = this.schema.safeParse(data);
    if (!result.success) {
      return { errors: toIssues(result.error), value: null };
    }
    return { errors: null, value: result.data };
  }
}
