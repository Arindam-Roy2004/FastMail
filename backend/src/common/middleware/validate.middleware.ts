import type { NextFunction, Request, Response } from "express";
import ApiError, { type ApiIssue } from "../utils/api-error.js";
import type { BaseDto } from "../dto/base.dto.js";

type DtoClass = typeof BaseDto;
type Part = "body" | "query" | "params";
type Schemas = Partial<Record<Part, DtoClass>>;

const validate = (schemas: Schemas) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: ApiIssue[] = [];
    const validated: Partial<Record<Part, unknown>> = {};

    for (const part of Object.keys(schemas) as Part[]) {
      const Dto = schemas[part];
      if (!Dto) continue;
      const raw = part === "body" ? (req.body ?? {}) : req[part];
      const { errors, value } = Dto.validate(raw);
      if (errors) {
        issues.push(...errors.map((e) => ({ ...e, path: `${part}.${e.path}` })));
      } else {
        validated[part] = value;
      }
    }

    if (issues.length) {
      throw ApiError.badRequest("Validation failed", issues);
    }
    req.validated = validated;
    next();
  };
};

export default validate;

export const validated = <T>(req: Request, part: Part): T => {
  if (!req.validated || !(part in req.validated)) {
    throw new Error(`Route ${req.method} ${req.route?.path ?? req.path} read unvalidated ${part}`);
  }
  return req.validated[part] as T;
};
