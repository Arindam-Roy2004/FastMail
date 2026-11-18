import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../../common/config/db.js";
import ApiError from "../../common/utils/api-error.js";
import { verifyAccessToken } from "../../common/utils/jwt.utils.js";
import { REFRESH_COOKIE } from "./auth.controller.js";
import { userFromRefreshToken } from "./auth.service.js";

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw ApiError.unauthorized("Not authenticated");

    const { sub } = verifyAccessToken(token);
    const user = await db.user.findUnique({
      where: { id: sub },
      select: { id: true, name: true, email: true, avatar: true },
    });
    if (!user) throw ApiError.unauthorized("User no longer exists");
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized("Invalid or expired token"));
      return;
    }
    next(err);
  }
};

export const authenticateCookie = async (req: Request, res: Response, next: NextFunction) => {
  const userId = await userFromRefreshToken(req.cookies?.[REFRESH_COOKIE]).catch(() => null);
  if (!userId) {
    res.status(401).type("text/plain").send("Sign in to the dashboard first, then reopen this page.");
    return;
  }
  next();
};
