import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { isProd } from "../config/env.js";
import ApiError from "../utils/api-error.js";

type AnyErr = Error & { statusCode?: number; status?: number; type?: string };

export const errorHandler = (err: AnyErr, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    console.error(`Error after response started on ${req.method} ${req.originalUrl}:`, err);
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.issues ? { issues: err.issues } : {}),
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body too large" });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ success: false, message: "Duplicate resource" });
    if (err.code === "P2025") return res.status(404).json({ success: false, message: "Not found" });
  }

  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  const body: Record<string, unknown> = {
    success: false,
    message: isProd ? "Internal server error" : err.message || "Internal server error",
  };
  if (!isProd) body.stack = err.stack;
  return res.status(500).json(body);
};
